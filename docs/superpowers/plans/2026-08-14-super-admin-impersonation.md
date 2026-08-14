# Super-Admin Impersonation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the super-admin "View as owner" action actually load and manage another business's dashboard, and close a pre-existing notifications IDOR.

**Architecture:** Client-side impersonation override. `business-provider` persists an impersonation target in `localStorage` and, for super-admins only, overrides the dashboard's `businessId` with it. The admin action navigates into `/dashboard`; a persistent banner in the dashboard layout exits back to `/admin`. Backend authorization is unchanged — super_admin already bypasses `requireBusinessAccess`, so full-manage works with no token machinery.

**Tech Stack:** Next.js App Router (client components), next-intl, Supabase JS auth, Express API, vitest + supertest (API tests only — the web app has no test runner).

## Global Constraints

- Impersonation override MUST only be honored when `user.user_metadata?.role === "super_admin"`. This is UX defense-in-depth; the real lock is the backend JWT role.
- localStorage key name: `impersonate_business`. Value: JSON `{ id: string, name: string }`.
- Reuse existing i18n keys under the `admin` namespace: `viewAs`, `impersonating`, `stopImpersonating` (already present in `packages/i18n/messages/{he,en,ar}.json`). No new i18n keys.
- The web app (`apps/web`) has no test framework — do NOT add one. Verify web changes by typecheck + manual steps. Only the API task (Task 4) has an automated test.
- Backend impersonation endpoints (`/api/admin/impersonate`, `/api/admin/stop-impersonate`) stay audit-log-only — do not change them.

---

### Task 1: Add impersonation state to `business-provider`

**Files:**
- Modify: `apps/web/src/components/auth/business-provider.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ session }` (from `apps/web/src/components/auth/auth-provider.tsx`); `session.user.user_metadata?.role`.
- Produces: extended `BusinessContextType` with `impersonating: { id: string; name: string } | null`, `startImpersonation(biz: { id: string; name: string }): void`, `stopImpersonation(): void`. `businessId` returns the impersonated id when impersonating.

- [ ] **Step 1: Read the current file**

Read `apps/web/src/components/auth/business-provider.tsx` in full (81 lines) so the edits below apply cleanly.

- [ ] **Step 2: Extend the context type**

Add to the `BusinessContextType` interface (currently ends after `switchBusiness`):

```tsx
interface BusinessContextType {
  businessId: string | null;
  hasNoBusiness: boolean;
  loading: boolean;
  businesses: Array<{ businessId: string; role: "owner" | "staff"; name: string }>;
  switchBusiness: (businessId: string) => void;
  impersonating: { id: string; name: string } | null;
  startImpersonation: (biz: { id: string; name: string }) => void;
  stopImpersonation: () => void;
}

const IMPERSONATE_KEY = "impersonate_business";
```

- [ ] **Step 3: Add impersonation state + super_admin gate**

Inside `BusinessProvider`, after the existing `const userId = session?.user?.id ?? null;` line, add:

```tsx
const isSuperAdmin = session?.user?.user_metadata?.role === "super_admin";
const [impersonating, setImpersonating] = useState<{ id: string; name: string } | null>(null);

// Load persisted impersonation on mount. Only super-admins may impersonate;
// a tampering non-admin's injected key is ignored and cleared. The backend
// independently returns 403 on any business-scoped call, so this gate is
// UX-only defense-in-depth, not the security boundary.
useEffect(() => {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(IMPERSONATE_KEY);
  if (!raw) return;
  if (!isSuperAdmin) {
    window.localStorage.removeItem(IMPERSONATE_KEY);
    setImpersonating(null);
    return;
  }
  try {
    const parsed = JSON.parse(raw) as { id: string; name: string };
    if (parsed?.id) setImpersonating(parsed);
  } catch {
    window.localStorage.removeItem(IMPERSONATE_KEY);
  }
}, [isSuperAdmin]);
```

- [ ] **Step 4: Add start/stop callbacks**

After the existing `switchBusiness` `useCallback`, add:

```tsx
const startImpersonation = useCallback((biz: { id: string; name: string }) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(biz));
  }
  setImpersonating(biz);
}, []);

const stopImpersonation = useCallback(() => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(IMPERSONATE_KEY);
  }
  setImpersonating(null);
}, []);
```

- [ ] **Step 5: Override `businessId` and expose the new values**

Replace the provider return block. The effective business id is the impersonated id when set (super_admin only), otherwise the resolved `businessId`:

```tsx
const effectiveBusinessId = impersonating && isSuperAdmin ? impersonating.id : businessId;

return (
  <BusinessContext.Provider
    value={{
      businessId: effectiveBusinessId,
      hasNoBusiness: impersonating && isSuperAdmin ? false : hasNoBusiness,
      loading,
      businesses,
      switchBusiness,
      impersonating: isSuperAdmin ? impersonating : null,
      startImpersonation,
      stopImpersonation,
    }}
  >
    {children}
  </BusinessContext.Provider>
);
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no errors related to `business-provider.tsx`. (Pre-existing unrelated errors, if any, are out of scope — confirm none reference this file.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/auth/business-provider.tsx
git commit -m "feat(web): add super-admin impersonation state to business-provider

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire the admin "View as owner" action to navigate into the dashboard

**Files:**
- Modify: `apps/web/src/app/[locale]/admin/page.tsx`

**Interfaces:**
- Consumes: `useBusiness()` → `startImpersonation` (from Task 1); `useRouter`, `useLocale` from `next/navigation` / `next-intl`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Read the relevant regions**

Read `apps/web/src/app/[locale]/admin/page.tsx` lines 1–75 (imports + state) and 140–229 (handlers + admin-page banner).

- [ ] **Step 2: Add imports**

At the top of the file, add the router/locale/business hooks. Add to the existing import group:

```tsx
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
```

- [ ] **Step 3: Wire hooks in the component**

Inside `AdminBusinessesPage`, after `const { session } = useAuth();`, add:

```tsx
const router = useRouter();
const locale = useLocale();
const { startImpersonation } = useBusiness();
```

- [ ] **Step 4: Rewrite `handleImpersonate` to navigate**

Replace the existing `handleImpersonate` (currently lines ~140–150) with:

```tsx
const handleImpersonate = async (biz: Business) => {
  try {
    await apiFetch("/api/admin/impersonate", {
      method: "POST",
      body: JSON.stringify({ business_id: biz.id }),
    }, token);
    startImpersonation({ id: biz.id, name: biz.name });
    router.push(`/${locale}/dashboard`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to start impersonation");
  }
};
```

- [ ] **Step 5: Remove the now-dead admin-page impersonation state, handler, and banner**

1. Delete the state line: `const [impersonating, setImpersonating] = useState<Business | null>(null);` (line ~67).
2. Delete the entire `handleStopImpersonate` function (lines ~152–164).
3. Delete the admin-page banner JSX block (lines ~218–229): the `{impersonating && ( <Card ...> ... </Card> )}` block.

**Note:** `AdminBusinessesPage` sits inside `admin/layout.tsx`, which does NOT wrap children in `BusinessProvider`. Verify in the next step that `useBusiness()` resolves here; if it throws "must be used within BusinessProvider", handle it in Task 2b below instead of shipping broken.

- [ ] **Step 6: Verify BusinessProvider covers the admin route**

Run: `grep -n "BusinessProvider" apps/web/src/app/[locale]/admin/layout.tsx apps/web/src/app/[locale]/layout.tsx`

- If `BusinessProvider` wraps the admin subtree (in either the admin layout or a shared parent layout): proceed to Step 7.
- If NOT present in the admin subtree: wrap the admin layout's children in `<BusinessProvider>` (import from `@/components/auth/business-provider`), mirroring how `dashboard/layout.tsx` nests it inside `AuthProvider` → `AuthGuard`. Then proceed.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no errors referencing `admin/page.tsx` (no unused `setImpersonating`, `impersonating`, `Card`/`CardContent` if now unused — remove unused imports if the compiler flags them).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/[locale]/admin/
git commit -m "feat(web): admin View-as-owner navigates into impersonated dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Add the persistent impersonation banner to the dashboard layout

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `useBusiness()` → `{ impersonating, stopImpersonation }` (Task 1); `apiFetch` from `@/lib/api`; `useAuth()` → `session` for the token; `useRouter`, `useLocale`, `useTranslations`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Read the file**

Read `apps/web/src/app/[locale]/dashboard/layout.tsx` in full (99 lines).

- [ ] **Step 2: Add imports**

Add to the top import block:

```tsx
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { apiFetch } from "@/lib/api";
```

(`useLocale` is already imported.)

- [ ] **Step 3: Add the banner component**

Add this component inside the file, above `DashboardShell`:

```tsx
function ImpersonationBanner() {
  const { impersonating, stopImpersonation } = useBusiness();
  const { session } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("admin");

  if (!impersonating) return null;

  const handleExit = async () => {
    try {
      await apiFetch(
        "/api/admin/stop-impersonate",
        { method: "POST", body: JSON.stringify({ business_id: impersonating.id }) },
        session?.access_token
      );
    } catch {
      // Audit-log call is best-effort; still exit locally.
    }
    stopImpersonation();
    router.push(`/${locale}/admin`);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2 bg-orange-500/90 text-white text-sm font-medium flex-shrink-0">
      <span>
        {t("impersonating")} <strong>{impersonating.name}</strong>
      </span>
      <button
        onClick={handleExit}
        className="rounded-md bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-semibold"
      >
        {t("stopImpersonating")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Render the banner in the shell**

In `DashboardShell`, render `<ImpersonationBanner />` as the first child of the outer flex container, above `<Sidebar />` so it spans full width:

```tsx
function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col md:h-screen md:overflow-hidden">
      <ImpersonationBanner />
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 md:overflow-hidden">
          <TopBar />
          <motion.main
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            className="flex-1 md:overflow-auto p-4 md:p-6"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}
```

(Note: the original outer div was `flex flex-col md:flex-row md:h-screen`; the banner needs to stack above the sidebar row, so the outer becomes `flex flex-col` and the sidebar+content are wrapped in a new `md:flex-row` div. Verify the layout still renders full-height in the manual step.)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no errors referencing `dashboard/layout.tsx`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/dashboard/layout.tsx
git commit -m "feat(web): persistent impersonation banner + exit in dashboard layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Close the notifications IDOR (`requireBusinessAccess`)

**Files:**
- Modify: `apps/api/src/routes/notifications.ts`
- Test: `apps/api/src/routes/notifications.test.ts` (create)

**Interfaces:**
- Consumes: `requireBusinessAccess` from `../middleware/auth`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Look first at an existing API route test to copy the app-bootstrap + auth-mock pattern:

Run: `ls apps/api/src/routes/*.test.ts apps/api/src/**/*.test.ts 2>/dev/null; grep -rln "requireBusinessAccess\|createApp\|supertest" apps/api/src --include="*.test.ts" | head`

Then create `apps/api/src/routes/notifications.test.ts`. Mirror the auth-mocking approach used by the nearest existing route test found above. The test asserts that a non-member authenticated user requesting another business's notifications gets 403 (i.e. `requireBusinessAccess` runs before the handler). Concretely, the test must:

- Build the Express app (via the same helper the sibling tests use).
- Mock `requireAuth` to attach a `ctx` for a normal user whose `memberships` do NOT include `business-B`, `role: "business_owner"`, `role !== "super_admin"`.
- `GET /api/businesses/business-B/notifications` with a bearer token.
- Assert `res.status === 403`.

If no sibling route test exists to copy an auth-mock from, write the test by mocking the `../middleware/auth` module so `requireAuth` injects `req.ctx = { role: "business_owner", memberships: [{ businessId: "business-A", role: "owner" }], userId: "u1" }` and `requireBusinessAccess` is the real implementation.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api exec vitest run src/routes/notifications.test.ts`
Expected: FAIL — current route lacks `requireBusinessAccess`, so the request reaches the handler and returns 200 (or a DB error), not 403.

- [ ] **Step 3: Add the guard**

In `apps/api/src/routes/notifications.ts`:

1. Add `requireBusinessAccess` to the import from `../middleware/auth`:

```ts
import { requireAuth, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
```

2. Insert `requireBusinessAccess` after `requireAuth` on the GET route:

```ts
router.get("/", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res, next) => {
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter api exec vitest run src/routes/notifications.test.ts`
Expected: PASS — non-member now gets 403.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/notifications.ts apps/api/src/routes/notifications.test.ts
git commit -m "fix(api): require business access on notifications route (IDOR)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the stack**

Run the app locally (`pnpm --filter web dev` + `pnpm --filter api dev`, or the project's usual dev command). Log in as a super-admin.

- [ ] **Step 2: Impersonate**

Go to `/{locale}/admin`. On a business row menu, click "צפה כבעלים" / "View as owner".
Expected: navigates to `/{locale}/dashboard`; an orange banner spans the top showing the business name; the calendar shows THAT business's appointments.

- [ ] **Step 3: Full-manage check**

Create or edit an appointment (or a service) while impersonating.
Expected: the write succeeds and persists (super_admin bypass authorizes it).

- [ ] **Step 4: Exit**

Click the banner's "Stop Viewing" button.
Expected: navigates back to `/{locale}/admin`; banner gone. Open `/dashboard` again → your own business context (or no-business state) is restored, not the impersonated one.

- [ ] **Step 5: Refresh persistence**

Impersonate again, then hard-refresh the dashboard page.
Expected: still impersonating (localStorage persisted); banner still shows.

- [ ] **Step 6: Tamper check (non-admin)**

Log in as a normal (non-admin) user. In devtools console:
`localStorage.setItem("impersonate_business", JSON.stringify({ id: "<some-other-business-id>", name: "X" }))`, then reload `/dashboard`.
Expected: no impersonation banner (provider ignores + clears the key); dashboard shows the user's own business only. Any manual API call to the other business returns 403.
