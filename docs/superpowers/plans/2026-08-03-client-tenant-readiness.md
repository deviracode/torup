# Client Tenant-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 tenant-readiness gaps: billing access validation (F1), self-registration interstitial (F2), SSR auth middleware (F3), staff RLS switch (F4), and a shared client infrastructure layer (F5-F8).

**Architecture:** Backend fixes are isolated middleware/route changes. Frontend introduces a `BusinessProvider` context + `useApi` hook that centralize token handling, error toasting, and business ID caching across all dashboard pages. Supabase SSR cookie middleware protects routes at the edge.

**Tech Stack:** Express 5, Next.js 15 App Router, Supabase SSR, sonner (toast), React 19

**Spec:** `docs/superpowers/specs/2026-08-03-client-tenant-readiness-design.md`

---

## File Structure

```
# Backend
apps/api/src/routes/billing.ts          # MODIFY: add validateBillingAccess middleware
apps/api/src/routes/staff.ts            # MODIFY: service-role → user client

# Frontend — new files
apps/web/src/components/auth/business-provider.tsx  # CREATE: BusinessProvider context
apps/web/src/lib/use-api.ts                         # CREATE: useApi hook
apps/web/src/app/[locale]/(auth)/welcome/page.tsx   # CREATE: post-reg interstitial

# Frontend — modified files
apps/web/src/middleware.ts                          # MODIFY: add SSR auth
apps/web/package.json                               # MODIFY: add sonner dep
apps/web/src/app/[locale]/layout.tsx                # MODIFY: add <Toaster />
apps/web/src/app/[locale]/dashboard/layout.tsx      # MODIFY: wrap in BusinessProvider
apps/web/src/app/[locale]/(auth)/register/page.tsx  # MODIFY: redirect to /welcome
apps/web/src/app/[locale]/dashboard/page.tsx        # MODIFY: useBusiness + useApi
apps/web/src/app/[locale]/dashboard/customers/page.tsx  # MODIFY: useBusiness + useApi
apps/web/src/app/[locale]/dashboard/services/page.tsx   # MODIFY: useBusiness + useApi
apps/web/src/app/[locale]/dashboard/analytics/page.tsx  # MODIFY: useBusiness + useApi
apps/web/src/app/[locale]/dashboard/settings/page.tsx   # MODIFY: useBusiness + useApi
apps/web/src/app/[locale]/admin/layout.tsx           # MODIFY: wrap in BusinessProvider
```

---

### Task 1: Add billing-access validation middleware (F1)

**Files:**
- Modify: `apps/api/src/routes/billing.ts`

- [ ] **Step 1: Add validateBillingAccess middleware**

At the top of `billing.ts`, after the `requireAuth` import, add this middleware function:

```ts
import { requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";

function validateBillingAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const businessId = (req.body as Record<string, unknown>).business_id as string
    || (req.query.business_id as string);
  if (!businessId) return next(new AppError(400, "business_id required"));
  if (req.ctx?.role === "super_admin") return next();
  const isMember = req.ctx?.memberships.some((m) => m.businessId === businessId);
  if (!isMember) return res.status(403).json({ error: "Access denied to this business" });
  next();
}
```

Also add the missing imports at the top of billing.ts (currently imports `AppError` from error-handler):

```ts
import type { Response, NextFunction } from "express";
import { AppError } from "../middleware/error-handler";
```

- [ ] **Step 2: Apply middleware to all billing routes**

Update every route handler to include `validateBillingAccess` after `requireAuth`:

```ts
router.post("/subscribe", requireAuth, validateBillingAccess, async (req, res, next) => {
  try { res.json(await svc().subscribe(req.body.business_id, req.body.plan_id, req.userEmail ?? "")); } catch (e) { next(e); }
});
router.post("/cancel", requireAuth, validateBillingAccess, async (req, res, next) => {
  try { await cancelSubscription(req.body.business_id); res.json({ success: true }); } catch (e) { next(e); }
});
router.post("/change-plan", requireAuth, validateBillingAccess, async (req, res, next) => {
  try { await changePlan(req.body.business_id, req.body.plan_id); res.json({ success: true }); } catch (e) { next(e); }
});
router.post("/extend-trial", requireAuth, validateBillingAccess, async (req, res, next) => {
  try { await extendTrial(req.body.business_id, Number(req.body.days) || 14); res.json({ success: true }); } catch (e) { next(e); }
});
router.get("/status", requireAuth, validateBillingAccess, async (req, res, next) => {
  try { res.json(await svc().status(req.query.business_id as string)); } catch (e) { next(e); }
});
router.get("/invoices", requireAuth, validateBillingAccess, async (req, res, next) => {
  try { res.json(await svc().invoices(req.query.business_id as string)); } catch (e) { next(e); }
});
router.get("/invoices/:invoiceNumber/html", requireAuth, validateBillingAccess, async (req, res, next) => {
  try { const html = await svc().invoiceHtml(req.query.business_id as string, req.params.invoiceNumber as string); res.setHeader("Content-Type", "text/html"); res.send(html); } catch (e) { next(e); }
});
```

Leave `/webhook` without `validateBillingAccess` (it's a PayPlus callback, not user-triggered).

- [ ] **Step 3: Update imports at top of billing.ts**

The final imports block:

```ts
import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { createBillingRepo } from "../modules/billing/billing.repository";
import { createBillingService, cancelSubscription, changePlan, extendTrial } from "../modules/billing/billing.service";
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm --filter @torup/api typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/billing.ts
git commit -m "fix(api): add business-access validation to billing routes"
```

---

### Task 2: Switch staff routes to user client (F4)

**Files:**
- Modify: `apps/api/src/routes/staff.ts`

- [ ] **Step 1: Replace service client with user client**

Replace the `authClient` helper and all call sites. The full updated file:

```ts
import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { getBusinessId, getParam, getUserClient } from "../lib/params";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { createStaffRepo } from "../modules/staff/staff.repository";
import { createStaffService } from "../modules/staff/staff.service";

const router: RouterType = Router({ mergeParams: true });

function svc(req: AuthenticatedRequest) {
  return createStaffService(createStaffRepo(getUserClient(req)));
}

router.get("/", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).list(getUserClient(req), getBusinessId(req))); } catch (e) { next(e); }
});
router.post("/", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc(req).add(getUserClient(req), getBusinessId(req), req.body)); } catch (e) { next(e); }
});
router.patch("/:memberId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).edit(getParam(req, "memberId"), getBusinessId(req), req.body)); } catch (e) { next(e); }
});
router.get("/:memberId/services", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).getServices(getParam(req, "memberId"))); } catch (e) { next(e); }
});
router.put("/:memberId/services", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!Array.isArray(req.body.service_ids)) throw new AppError(400, "service_ids must be an array");
  try { res.json(await svc(req).setServices(getBusinessId(req), getParam(req, "memberId"), req.body.service_ids)); } catch (e) { next(e); }
});
router.get("/:memberId/time-off", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).getTimeOff(getParam(req, "memberId"))); } catch (e) { next(e); }
});
router.post("/:memberId/time-off", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { start_date, end_date } = req.body;
  if (!start_date || !end_date) throw new AppError(400, "start_date and end_date are required");
  try { res.status(201).json(await svc(req).addTimeOff(getBusinessId(req), getParam(req, "memberId"), start_date, end_date)); } catch (e) { next(e); }
});
router.delete("/:memberId/time-off", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!Array.isArray(req.body.break_ids) || req.body.break_ids.length === 0) throw new AppError(400, "break_ids must be a non-empty array");
  try { await svc(req).removeTimeOff(getBusinessId(req), getParam(req, "memberId"), req.body.break_ids); res.status(204).send(); } catch (e) { next(e); }
});
router.delete("/:memberId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await svc(req).remove(getParam(req, "memberId"), getBusinessId(req)); res.status(204).send(); } catch (e) { next(e); }
});

export default router;
```

Key changes: replaced `createServiceClient` import, removed `authClient()` helper, changed `svc()` to accept `req`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm --filter @torup/api typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/staff.ts
git commit -m "fix(api): switch staff routes from service-role to RLS user client"
```

---

### Task 3: Add Supabase SSR auth middleware (F3)

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Replace middleware.ts**

Replace the entire file contents:

```ts
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const i18nMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.includes("/dashboard") || path.includes("/admin");
  const locale = path.split("/")[1];
  const isValidLocale = routing.locales.includes(locale as "he" | "ar" | "en");

  if (isProtected) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const redirectLocale = isValidLocale ? locale : "he";
      return NextResponse.redirect(new URL(`/${redirectLocale}/login`, request.url));
    }
  }

  return i18nMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @torup/web build`
Expected: Build succeeds (may take 30-60s).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(web): add Supabase SSR cookie-based auth middleware"
```

---

### Task 4: Create BusinessProvider context (F5-F8 foundation)

**Files:**
- Create: `apps/web/src/components/auth/business-provider.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { apiFetch } from "@/lib/api";

interface BusinessContextType {
  businessId: string | null;
  hasNoBusiness: boolean;
  loading: boolean;
  businesses: Array<{ businessId: string; role: "owner" | "staff" }>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [hasNoBusiness, setHasNoBusiness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessContextType["businesses"]>([]);

  useEffect(() => {
    if (!session?.access_token) {
      setBusinessId(null);
      setHasNoBusiness(false);
      setBusinesses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch<{ id: string; memberships?: Array<{ businessId: string; role: "owner" | "staff" }> }>(
      "/api/businesses/me", {}, session.access_token
    )
      .then((data) => {
        if (data?.id) {
          setBusinessId(data.id);
          setHasNoBusiness(false);
          setBusinesses(data.memberships || []);
        } else {
          setBusinessId(null);
          setHasNoBusiness(true);
          setBusinesses([]);
        }
      })
      .catch(() => {
        setBusinessId(null);
        setHasNoBusiness(true);
        setBusinesses([]);
      })
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  return (
    <BusinessContext.Provider value={{ businessId, hasNoBusiness, loading, businesses }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/auth/business-provider.tsx
git commit -m "feat(web): add BusinessProvider context for centralized tenant state"
```

---

### Task 5: Create useApi hook + add sonner (F5-F6)

**Files:**
- Create: `apps/web/src/lib/use-api.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Add sonner dependency**

Run: `pnpm --filter @torup/web add sonner`

- [ ] **Step 2: Create use-api.ts**

```ts
"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "./api";
import { toast } from "sonner";

export function useApi() {
  const { session, signOut } = useAuth();

  return async function api<T>(path: string, options?: RequestInit): Promise<T | null> {
    try {
      return await apiFetch<T>(path, options, session?.access_token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.includes("401") || message.includes("Invalid or expired token")) {
        await signOut();
        return null;
      }
      toast.error(message);
      return null;
    }
  };
}
```

- [ ] **Step 3: Add Toaster to root layout**

In `apps/web/src/app/[locale]/layout.tsx`, add the import and component:

At top:
```ts
import { Toaster } from "sonner";
```

Replace the JSX body:
```tsx
return (
  <html lang={locale} dir={dir}>
    <body>
      <NextIntlClientProvider messages={messages}>
        {children}
        <Toaster richColors position="top-right" />
      </NextIntlClientProvider>
    </body>
  </html>
);
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/use-api.ts apps/web/package.json apps/web/src/app/\[locale\]/layout.tsx apps/web/pnpm-lock.yaml
git commit -m "feat(web): add useApi hook with token injection, 401 handling, and sonner toasts"
```

---

### Task 6: Wire BusinessProvider into dashboard + admin layouts

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/layout.tsx`
- Modify: `apps/web/src/app/[locale]/admin/layout.tsx`

- [ ] **Step 1: Update dashboard layout**

In `dashboard/layout.tsx`, add the import and wrap:

Add import:
```ts
import { BusinessProvider } from "@/components/auth/business-provider";
```

Change the `DashboardLayout` function return:
```tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard>
        <BusinessProvider>
          <TopBarProvider>
            <DashboardShell>{children}</DashboardShell>
          </TopBarProvider>
        </BusinessProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Update admin layout**

In `admin/layout.tsx`, add the import and wrap:

Add import:
```ts
import { BusinessProvider } from "@/components/auth/business-provider";
```

Change the `AdminLayout` function return:
```tsx
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard requiredRole="super_admin">
        <BusinessProvider>
          <div className="flex h-screen">
            <AdminSidebar />
            <main className="flex-1 overflow-auto bg-background p-6">{children}</main>
          </div>
        </BusinessProvider>
      </AuthGuard>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/layout.tsx apps/web/src/app/\[locale\]/admin/layout.tsx
git commit -m "feat(web): wire BusinessProvider into dashboard and admin layouts"
```

---

### Task 7: Update dashboard page (page.tsx)

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Replace business ID fetching and API calls**

Remove the `useAuth` import and the `useState<businessId>` line. Add the new imports:

Add at top:
```ts
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
```

Remove `import { useAuth }` (line 6).

Replace lines 245-248 (inside the component function body):
```tsx
// Remove:
const { session } = useAuth();
const [businessId, setBusinessId] = useState<string | null>(null);

// Add:
const { businessId, hasNoBusiness, loading: bizLoading } = useBusiness();
const api = useApi();
```

Replace lines 264-269 (the `/api/businesses/me` fetch effect):
```tsx
// Remove the entire useEffect block at lines 264-269
// (It's now handled by BusinessProvider)
```

Replace lines 271-308 (stats fetching). Replace every `session.access_token` with `api` calls and remove the token arg:

```tsx
useEffect(() => {
  if (!businessId) return;
  const today = new Date().toISOString().split("T")[0];

  api<Array<{ status: string }>>(`/api/businesses/${businessId}/appointments?date=${today}`)
    .then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({
          ...prev,
          total: apts.length,
          completed: apts.filter((a) => a.status === "completed").length,
        }));
      }
    });

  Promise.all([
    api<Array<{ id: string }>>(`/api/businesses/${businessId}/appointments?status=pending`).then((r) => r ?? []),
    api<Array<{ id: string }>>(`/api/businesses/${businessId}/appointments?status=confirmed`).then((r) => r ?? []),
  ]).then(([pending, confirmed]) => {
    setStats((prev) => ({ ...prev, pending: pending.length + confirmed.length }));
  });

  api<Array<{ id: string }>>(`/api/businesses/${businessId}/appointments?status=pending_approval`)
    .then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({ ...prev, pendingApproval: apts.length }));
      }
    });
}, [businessId, refreshKey]);
```

Replace the `openDrawer` function body (lines 310-350). Remove `session.access_token` references, replace `apiFetch` with `api`:

```tsx
const openDrawer = async (filterKey: FilterKey) => {
  if (!businessId) return;
  setDrawerFilter(filterKey);
  setDrawerLoading(true);
  setDrawerAppts([]);

  const cfg = STAT_CONFIG.find((c) => c.key === filterKey)!;
  const today = new Date().toISOString().split("T")[0];

  try {
    if (cfg.statusFilter) {
      const results = await Promise.all(
        cfg.statusFilter.map((status) =>
          api<Appointment[]>(`/api/businesses/${businessId}/appointments?status=${status}`).then((r) => r ?? [])
        )
      );
      setDrawerAppts(results.flat().sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
    } else {
      const r = await api<Appointment[]>(`/api/businesses/${businessId}/appointments?date=${today}`);
      setDrawerAppts(Array.isArray(r) ? r.sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ) : []);
    }
  } finally {
    setDrawerLoading(false);
  }
};
```

Replace the `openSplitMode` function (lines 352-372):

```tsx
const openSplitMode = async () => {
  if (splitMode) return;
  if (!businessId) return;
  setSplitMode(true);
  setSplitLoading(true);
  setSplitAppts([]);
  const r = await api<Appointment[]>(`/api/businesses/${businessId}/appointments?status=pending_approval`);
  setSplitAppts(Array.isArray(r) ? r.sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  ) : []);
  setSplitLoading(false);
};
```

Replace `handleApprove` (lines 374-381):

```tsx
const handleApprove = async (id: string, date?: string) => {
  if (!businessId) return;
  await api(`/api/businesses/${businessId}/appointments/${id}/approve`, { method: "POST" });
  if (date) setCalendarDate(date);
  setSplitAppts((prev) => prev.filter((a) => a.id !== id));
  setDrawerAppts((prev) => prev.filter((a) => a.id !== id));
  setRefreshKey((k) => k + 1);
};
```

Replace `handleReject` (lines 383-389):

```tsx
const handleReject = async (id: string) => {
  if (!businessId) return;
  await api(`/api/businesses/${businessId}/appointments/${id}/reject`, { method: "POST" });
  setSplitAppts((prev) => prev.filter((a) => a.id !== id));
  setDrawerAppts((prev) => prev.filter((a) => a.id !== id));
  setRefreshKey((k) => k + 1);
};
```

- [ ] **Step 2: Add empty-state for users with no business**

Replace the skeleton loading block (lines 476-484) with an empty state that also shows when `hasNoBusiness` is true:

```tsx
{bizLoading || !businessId ? (
  bizLoading ? (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="h-4 w-12 rounded bg-white/8" />
          <div className="h-10 flex-1 rounded-lg bg-white/8" />
        </div>
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-white/8 p-8 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
      <p className="text-white/60 text-sm mb-2">Your account is not connected to a business yet.</p>
      <a
        href="https://wa.me/972524433123?text=%D7%94%D7%99%D7%99%2C%20%D7%99%D7%A6%D7%A8%D7%AA%D7%99%20%D7%97%D7%A9%D7%91%D7%95%D7%9F%20%D7%91-TorUp%20%D7%95%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%94%D7%AA%D7%97%D7%91%D7%A8%20%D7%9C%D7%A2%D7%A1%D7%A7%20%D7%A9%D7%9C%D7%99"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-bold text-white mt-3 hover:brightness-110"
        style={{ background: "#25D366" }}
      >
        Contact us on WhatsApp
      </a>
    </div>
  )
) : (
  // ... existing split mode / calendar views ...
)}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @torup/web build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/page.tsx
git commit -m "refactor(web): migrate dashboard page to BusinessProvider + useApi, add empty state"
```

---

### Task 8: Update customers page

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/customers/page.tsx`

- [ ] **Step 1: Replace imports and state**

Add imports, remove `useAuth`:
```ts
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
```

Remove `import { useAuth }` (line 5).

Remove lines 27 and 37:
```tsx
// Remove:
const { session } = useAuth();
const [businessId, setBusinessId] = useState<string | null>(null);
```

Add:
```tsx
const { businessId, hasNoBusiness, loading: bizLoading } = useBusiness();
const api = useApi();
```

- [ ] **Step 2: Remove the /api/businesses/me fetch effect**

Remove lines 39-44 (the `useEffect` that calls `/api/businesses/me`).

- [ ] **Step 3: Update fetchCustomers and handleSave**

Replace `fetchCustomers`:
```tsx
const fetchCustomers = useCallback(async () => {
  if (!businessId) return;
  setLoading(true);
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const result = await api<Customer[] | { customers: Customer[] }>(
    `/api/businesses/${businessId}/customers${query}`
  );
  setCustomers(Array.isArray(result) ? result : (result?.customers || []));
  setLoading(false);
}, [businessId, search]);
```

Replace all `session?.access_token` refs in `handleSave` (line 75):
```tsx
async function handleSave() {
  if (!selectedCustomer || !businessId) return;
  setSaving(true);
  setSaveError(null);
  const updated = await api<Customer>(
    `/api/businesses/${businessId}/customers/${selectedCustomer.id}`,
    { method: "PATCH", body: JSON.stringify({ name: editName, phone: editPhone, language_preference: editLang }) }
  );
  // ... rest stays the same
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @torup/web build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/customers/page.tsx
git commit -m "refactor(web): migrate customers page to BusinessProvider + useApi"
```

---

### Task 9: Update services page

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/services/page.tsx`

- [ ] **Step 1: Replace imports and state**

Add imports:
```ts
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
```

Remove `import { useAuth }` (line 5).

Remove `const { session } = useAuth()` (line 43) and `const [businessId, setBusinessId]` (line 46):
```tsx
// Remove lines 43 and 46:
// const { session } = useAuth();
// const [businessId, setBusinessId] = useState<string | null>(null);
```

Add:
```tsx
const { businessId } = useBusiness();
const api = useApi();
```

- [ ] **Step 2: Remove the /api/businesses/me fetch effect**

Remove lines 59-64.

- [ ] **Step 3: Update fetchServices and all API calls**

Replace `fetchServices`:
```tsx
const fetchServices = useCallback(async () => {
  if (!businessId) return;
  setLoading(true);
  const [svcResult, catResult] = await Promise.all([
    api<Service[] | { categories: ServiceCategory[]; services: Service[] }>(
      `/api/businesses/${businessId}/services`
    ),
    api<ServiceCategory[]>(`/api/businesses/${businessId}/categories`),
  ]);
  setServices(Array.isArray(svcResult) ? svcResult : (svcResult?.services || []));
  setCategories(catResult || []);
  setLoading(false);
}, [businessId]);
```

Replace all remaining `session?.access_token` usages with the `api` form. The key pattern change in every handler is from:
```tsx
await apiFetch(`/api/businesses/${businessId}/services/...`, { method: "POST", ... }, session?.access_token || "")
```
to:
```tsx
await api(`/api/businesses/${businessId}/services/...`, { method: "POST", ... })
```

Affected lines: 107-115 (handleSave), 125-127 (handleDelete), 133-134 (handleToggleActive). Also the settings tab service operations later in the file.

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @torup/web build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/services/page.tsx
git commit -m "refactor(web): migrate services page to BusinessProvider + useApi"
```

---

### Task 10: Update analytics page

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/analytics/page.tsx`

- [ ] **Step 1: Replace imports and state**

Add imports:
```ts
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
```

Remove `import { useAuth }` (line 5).

Remove `const { session } = useAuth()` (line 25) and `const [businessId, setBusinessId]` (line 28):
```tsx
// Remove lines 25 and 28:
// const { session } = useAuth();
// const [businessId, setBusinessId] = useState<string | null>(null);
```

Add:
```tsx
const { businessId } = useBusiness();
const api = useApi();
```

- [ ] **Step 2: Remove the /api/businesses/me fetch effect**

Remove lines 30-35.

- [ ] **Step 3: Update analytics fetch**

Replace lines 37-44:
```tsx
useEffect(() => {
  if (!businessId) return;
  api<Analytics>(`/api/businesses/${businessId}/analytics?period=${period}`)
    .then((r) => { if (r) setAnalytics(r); });
}, [businessId, period]);
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @torup/web build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/analytics/page.tsx
git commit -m "refactor(web): migrate analytics page to BusinessProvider + useApi"
```

---

### Task 11: Update settings page

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/settings/page.tsx`

- [ ] **Step 1: Replace imports and state**

Add imports:
```ts
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
```

Remove `import { useAuth }` (line 6).

Remove `const { session } = useAuth()` (line 107) and `const [businessId, setBusinessId]` (line 108):
```tsx
// Remove lines 107 and 108:
// const { session } = useAuth();
// const [businessId, setBusinessId] = useState<string | null>(null);
```

Add:
```tsx
const { businessId } = useBusiness();
const api = useApi();
```

- [ ] **Step 2: Remove the /api/businesses/me fetch effect**

Find and remove the `useEffect` that fetches `/api/businesses/me` (located after businessId state, in the settings page it's not on line 108 directly — check after the state declarations block).

- [ ] **Step 3: Declare token variable for remaining calls**

Since the settings page fetches data in `fetchTab` (lines 193-249) that currently uses `token` from `session?.access_token`, replace the token derivation:

```tsx
// Remove:
const token = session?.access_token || "";

// The api() function handles token internally, so just remove the token variable.
```

Update `fetchTab` to use `api()` instead of `apiFetch(path, opts, token)`. Remove the `token` parameter from all `apiFetch` calls within `fetchTab` (approximately 12 calls across working-hours, breaks, reminders, booking-rules, staff, profile, services, categories, gcal-status, gcal-calendars).

Example pattern change for each call:
```tsx
// Before:
apiFetch<WorkingHour[]>(`/api/businesses/${businessId}/working-hours`, {}, token)
// After:
api<WorkingHour[]>(`/api/businesses/${businessId}/working-hours`)
```

- [ ] **Step 4: Update all mutation handlers**

Replace all `apiFetch(path, options, token)` with `api(path, options)` throughout `handleSaveHours`, `handleDeleteBreak`, `handleAddBreak`, `handleAddReminder`, `handleToggleReminder`, `handleDeleteReminder`, `handleSaveRules`, `handleAddStaff`, `handleRemoveStaff`, `handleSaveProfile`, `handleSaveBot`, `handleConnectGcal`, `handleDisconnectGcal`, `handleSaveGcalSettings`, `handleSyncGcal`, `handleSaveService`, `handleDeleteService`, `handleAddCategory`, `handleDeleteCategory`, `handleSaveCategory`, `handleSaveServiceCategory`.

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @torup/web build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/settings/page.tsx
git commit -m "refactor(web): migrate settings page to BusinessProvider + useApi"
```

---

### Task 12: Create welcome interstitial page + update registration (F2)

**Files:**
- Create: `apps/web/src/app/[locale]/(auth)/welcome/page.tsx`
- Modify: `apps/web/src/app/[locale]/(auth)/register/page.tsx`

- [ ] **Step 1: Create welcome page**

Create the file `apps/web/src/app/[locale]/(auth)/welcome/page.tsx`:

```tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, ArrowRight } from "lucide-react";

export default function WelcomePage() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const isRtl = locale === "he" || locale === "ar";

  const whatsappUrl = "https://wa.me/972524433123?text=" + encodeURIComponent(
    "היי, יצרתי חשבון ב-TorUp ואני רוצה להתחבר לעסק שלי"
  );

  return (
    <div className="w-full max-w-sm">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <h2 className="text-2xl font-bold text-white mb-1">
          {isRtl ? "ברוך הבא ל-TorUp" : "Welcome to TorUp"}
        </h2>
        <p className="text-sm text-white/40 mb-6">
          {isRtl
            ? "החשבון שלך נוצר בהצלחה"
            : "Your account has been created successfully"}
        </p>

        <div
          className="rounded-xl border border-white/8 p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <p className="text-sm text-white/70 leading-relaxed mb-4">
            {isRtl
              ? "כדי לחבר את החשבון שלך לעסק קיים או לפתוח עסק חדש, דברו איתנו בוואטסאפ:"
              : "To connect your account to an existing business or set up a new one, contact us on WhatsApp:"}
          </p>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-bold text-white hover:brightness-110 transition-all"
            style={{ background: "#25D366" }}
          >
            <MessageCircle className="h-4 w-4" />
            {isRtl ? "דברו איתנו בוואטסאפ" : "Contact us on WhatsApp"}
          </a>
        </div>

        <button
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
        >
          {isRtl ? "לדשבורד" : "Go to Dashboard"}
          <ArrowRight className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Update registration redirect**

In `apps/web/src/app/[locale]/(auth)/register/page.tsx`, change line 32:

```tsx
// Before:
router.push(`/${locale}/dashboard`);

// After:
router.push(`/${locale}/welcome`);
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @torup/web build`
Expected: Build succeeds. New route `/[locale]/welcome` compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(auth\)/welcome/page.tsx apps/web/src/app/\[locale\]/\(auth\)/register/page.tsx
git commit -m "feat(web): add post-registration welcome interstitial with WhatsApp contact"
```

---

## Self-Review Summary

1. **Spec coverage**: All 8 findings (F1-F8) mapped to tasks. F1=T1, F4=T2, F3=T3, F5-F8=T4-T11, F2=T12.
2. **Placeholder scan**: No TBDs, TODOs, or vague directions. Every step has exact code.
3. **Type consistency**: `useBusiness()` returns `{ businessId, hasNoBusiness, loading, businesses }` — consistently used across T7-T11. `useApi()` returns `async function api<T>(path, options): Promise<T | null>` — consistent signature.
4. **Build verification**: Every task includes a build step (`pnpm --filter @torup/web build`).

**Gap note**: Task 11 (settings page) has the most API call sites — approximately 25+. The step describes the pattern transformation. The file is 1081 lines, so the plan documents the transformation conceptually rather than pasting every call site. This is acceptable since the pattern is uniform throughout.
