# Client Tenant-Readiness — Design Spec

**Date**: 2026-08-03 | **Branch**: `torup-tenant-env` | **Based on**: [Client Tenant Audit](../2026-08-03-client-tenant-audit.md)

---

## Overview

This design addresses 8 findings from the tenant-readiness audit. The fixes fall into two categories:

**Backend** (API-level, self-contained):
- F1: Add `requireBusinessAccess` to billing routes
- F4: Switch staff routes from service-role to user client (RLS)

**Frontend** (web app, connected via shared infrastructure):
- F2: Post-registration interstitial page with WhatsApp contact link
- F3: Supabase SSR cookie-based auth middleware
- F5-F8: `BusinessProvider` context + `useApi` hook (centralized token handling, error toasting, business ID caching, enables future business-switcher)

---

## Backend Fixes

### F1: Billing Routes — Business-Access Validation

**Current state** (`apps/api/src/routes/billing.ts`): All billing endpoints use only `requireAuth`. The `business_id` comes from `req.body` or `req.query` with no validation that the authenticated user belongs to that business.

**Fix**: Add a middleware that validates `business_id` against `req.ctx.memberships`:

```ts
// New middleware in billing.ts (or auth.ts)
function validateBillingAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const businessId = req.body.business_id || req.query.business_id as string;
  if (!businessId) return next(new AppError(400, "business_id required"));
  if (req.ctx?.role === "super_admin") return next();
  const isMember = req.ctx?.memberships.some(m => m.businessId === businessId);
  if (!isMember) return res.status(403).json({ error: "Access denied" });
  next();
}
```

Apply to: `/subscribe`, `/cancel`, `/change-plan`, `/extend-trial`, `/status`, `/invoices`, `/invoices/:invoiceNumber/html`.

The billing routes live under `/api/billing` (not business-URL-scoped), so the middleware extracts `business_id` from the request body/query rather than route params.

### F4: Staff Routes — Switch to User Client (RLS)

**Current state** (`apps/api/src/routes/staff.ts`): All DB access uses `createServiceClient()` which bypasses RLS.

**Fix**: Replace `createServiceClient()` with `getUserClient(req)` throughout:

```ts
// Before:
function authClient() { return createServiceClient(); }
router.get("/", requireAuth, requireBusinessAccess, async (req, res, next) => {
  res.json(await svc().list(authClient(), getBusinessId(req)));
});

// After:
router.get("/", requireAuth, requireBusinessAccess, async (req, res, next) => {
  res.json(await svc().list(getUserClient(req), getBusinessId(req)));
});
```

Applies to: GET `/`, POST `/`, PATCH `/:memberId`, GET `/:memberId/services`, PUT `/:memberId/services`, GET `/:memberId/time-off`, POST `/:memberId/time-off`, DELETE `/:memberId/time-off`, DELETE `/:memberId`.

`requireBusinessAccess` stays as the middleware gate. The user client provides defense-in-depth via RLS.

---

## Frontend Fixes

### F3: Supabase SSR Cookie Middleware

**Current state** (`apps/web/src/middleware.ts`): Only `next-intl` i18n routing. No auth.

**Fix**: Replace with Supabase SSR pattern that refreshes session cookies and protects routes:

```ts
// middleware.ts
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

  await supabase.auth.getUser(); // refreshes session

  const path = request.nextUrl.pathname;
  const isProtected = path.includes("/dashboard") || path.includes("/admin");
  const { data: { user } } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const locale = path.split("/")[1] || "he";
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return i18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

This eliminates the client-side flash-of-unauthenticated-content on dashboard/admin pages — the redirect happens at the edge before any page code runs.

### F5-F8: BusinessProvider + useApi Hook

**New file: `apps/web/src/components/auth/business-provider.tsx`**

A React context wrapping the dashboard/admin layouts that:

1. Fetches `/api/businesses/me` once on auth (or on session change)
2. Provides `businessId`, `hasNoBusiness`, and `businesses` to all children
3. Eliminates the duplicated pattern of every dashboard page independently fetching `/api/businesses/me`

```ts
interface BusinessContextType {
  businessId: string | null;
  hasNoBusiness: boolean;
  loading: boolean;
  businesses: Array<{ businessId: string; role: "owner" | "staff" }>;
}
```

**Flow when user has no business**: The provider sets `hasNoBusiness = true`, `businessId = null`. Dashboard pages show an empty-state card with the same WhatsApp contact info from the interstitial page.

**New file: `apps/web/src/lib/use-api.ts`**

A hook that wraps `apiFetch` with automatic token injection, 401 handling, and error toasting:

```ts
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

**Add sonner** for toast notifications (`pnpm add sonner` in apps/web). Add `<Toaster />` to the root layout.

**Impact on existing pages**: Every dashboard page currently does:
```ts
const { session } = useAuth();
const [businessId, setBusinessId] = useState(null);
useEffect(() => {
  apiFetch("/api/businesses/me", {}, session.access_token)
    .then(r => setBusinessId(r.id)).catch(() => {});
}, [session.access_token]);
```

After the change:
```ts
const { businessId, hasNoBusiness } = useBusiness();
const api = useApi();
const data = await api(`/api/businesses/${businessId}/appointments?date=${today}`);
```

No more per-component token passing, no silent catches, no duplicate `/api/businesses/me` fetches.

### F2: Post-Registration Interstitial Page

**New file: `apps/web/src/app/[locale]/(auth)/welcome/page.tsx`**

After successful registration, redirect to `/[locale]/welcome` instead of `/dashboard`.

**Page content** (in the auth layout group, follows the existing branded panel + form card pattern):

- Title: "Welcome to TorUp" (localized he/ar/en)
- Body: "Your account has been created. To connect your account to an existing business or set up a new business, please contact us via WhatsApp."
- WhatsApp link button: Opens `https://wa.me/972524433123` with a pre-filled message in Hebrew: "היי, יצרתי חשבון ב-TorUp ואני רוצה להתחבר לעסק שלי"
- Secondary button: "Go to Dashboard" → navigates to `/dashboard`

**Changes to `register/page.tsx`**: Line 32: redirect to `/${locale}/welcome` instead of `/${locale}/dashboard`.

**Fallback on dashboard**: If a user navigates directly to `/dashboard` with no business, the `hasNoBusiness` flag from `BusinessProvider` triggers an empty state card showing the same WhatsApp contact info (covers the re-login case for users whose business was removed).

---

## Files Changed

| File | Change |
|------|--------|
| `apps/api/src/routes/billing.ts` | Add `validateBillingAccess` middleware to all routes |
| `apps/api/src/routes/staff.ts` | Replace `createServiceClient()` with `getUserClient(req)` |
| `apps/web/src/middleware.ts` | Replace i18n-only with Supabase SSR auth middleware |
| `apps/web/src/app/[locale]/(auth)/welcome/page.tsx` | **New** — post-registration interstitial |
| `apps/web/src/app/[locale]/(auth)/register/page.tsx` | Change redirect to `/welcome` |
| `apps/web/src/components/auth/business-provider.tsx` | **New** — BusinessProvider context |
| `apps/web/src/lib/use-api.ts` | **New** — useApi hook |
| `apps/web/src/app/[locale]/layout.tsx` | Add `<Toaster />` |
| `apps/web/src/app/[locale]/dashboard/layout.tsx` | Wrap children in `<BusinessProvider>` |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | Use `useBusiness()` + `useApi()`, replace skeleton with empty state |
| `apps/web/src/app/[locale]/dashboard/customers/page.tsx` | Use `useBusiness()` + `useApi()` |
| `apps/web/src/app/[locale]/dashboard/services/page.tsx` | Use `useBusiness()` + `useApi()` |
| `apps/web/src/app/[locale]/dashboard/analytics/page.tsx` | Use `useBusiness()` + `useApi()` |
| `apps/web/src/app/[locale]/dashboard/settings/page.tsx` | Use `useBusiness()` + `useApi()` |
| `apps/web/src/app/[locale]/admin/layout.tsx` | Wrap in `<BusinessProvider>` (for super_admin) |
| `apps/web/package.json` | Add `sonner` dependency |

---

## Testing

- **F1**: Verify billing routes return 403 for non-member `business_id`. Verify super-admin bypasses.
- **F2**: Register new user → lands on `/welcome` → WhatsApp link works → "Go to Dashboard" navigates to dashboard with empty state.
- **F3**: Visit `/dashboard` while logged out → redirected to `/login`. Visit `/dashboard` while logged in → shows dashboard. Cookie session survives page refresh.
- **F4**: Verify staff routes with RLS user client work correctly for both members and non-members.
- **F5-F8**: Verify `useApi` toasts errors. Verify 401 triggers signOut and redirect. Verify `businessId` is available in all dashboard pages without individual fetches.

---

## Out of Scope (Future)

- F7: Business-switcher dropdown UI — enabled by `BusinessProvider.businesses` array but not built now
- Google Calendar routes (intentionally stay on service-role due to deny-all RLS on tokens table)
- Billing page functional integration (currently hardcoded placeholder)
