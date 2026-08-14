# Super-Admin Impersonation ("View as Owner") — Design

**Date:** 2026-08-14
**Status:** Approved, ready for implementation plan

## Problem

A super-admin cannot actually manage another business from the UI. On `/admin`, clicking the
row action "צפה כבעלים" ("View as owner") runs `handleImpersonate`, which:

1. POSTs to `/api/admin/impersonate` (backend only writes an audit log, returns the business).
2. Sets a **local** `impersonating` state on the admin page → paints an orange banner **on `/admin`**.

It never navigates to the dashboard and never changes which `businessId` the dashboard uses.
Nothing scoped to the target business ever loads. The feature is non-functional theater.

## Root Cause

The dashboard scopes every API call off `businessId` from `business-provider.tsx`, which is
populated **only** from `/api/businesses/me` (the admin's own memberships). There is no mechanism
to point the dashboard at a business the admin does not belong to. Additionally,
`business-provider.switchBusiness` guards against non-member businesses
(`businesses.some((b) => b.businessId === newBusinessId)`), so an admin cannot switch into
someone else's business.

The backend, however, **already authorizes super_admin for any business**: `requireBusinessAccess`
(`apps/api/src/middleware/auth.ts:101`) returns early when `req.ctx.role === "super_admin"`.

## Security Model (verified)

The authorization lock is enforced **at the backend, by the verified Supabase JWT** — not by the
client. `req.ctx.role` is derived from `user.user_metadata.role` decoded from the JWT
(`auth.ts:40`). Client-side state (localStorage) cannot forge the role.

- A non-admin who injects the impersonation key into localStorage still sends their own JWT.
- Every business-scoped write/manage route runs `requireAuth` + `requireBusinessAccess`
  (verified across: services, categories, configuration, appointments, customers, staff,
  waitlist, google-calendar, whatsapp). Non-admin → `403 Access denied`.
- The frontend super_admin guard in `business-provider` is **UX-only defense-in-depth**, not the
  security boundary. It avoids showing a broken, unauthorized dashboard to a tampering non-admin.
  Data protection never relies on it.

### Pre-existing issue folded into this change

`apps/api/src/routes/notifications.ts` GET `/` runs `requireAuth` **only**, missing
`requireBusinessAccess` — an IDOR: any authenticated user could target
`/api/businesses/:businessId/notifications` for a business they don't belong to. It uses the
RLS-scoped `getUserClient(req)`, so RLS may already block it, but the app-layer guard is the
pattern every sibling route follows and is required for correct super_admin behavior under
impersonation. **Fix: add `requireBusinessAccess` after `requireAuth`.**

`apps/api/src/routes/availability.ts` GET `/` is intentionally public (anon client, returns only
computed slots for storefront booking). Verified safe — no change.

## Approach

Client-side impersonation override. Persist an impersonation target in `localStorage`;
`business-provider` reads it and overrides `businessId`. **Full manage** — the backend already
permits super_admin writes, so no view-only guards are added. Rejected alternative: server-side
scoped tokens (heavier — token minting, refresh, security surface — and unnecessary since
authorization already keys off the super_admin role in the JWT).

`/admin` and `/dashboard` are separate route trees, each with its own `BusinessProvider`, so the
impersonation state must survive navigation across trees. `localStorage` is the carrier (chosen
over sessionStorage so a refresh keeps the admin impersonating).

## Components

### 1. `apps/web/src/components/auth/business-provider.tsx`
- On mount, read `localStorage["impersonate_business"]` = `{ id, name }`.
- If present **and** `session.user.user_metadata.role === "super_admin"`: override the resolved
  `businessId` with the impersonated id (instead of the `/api/businesses/me` result).
- If the key is present but the user is not super_admin: ignore and clear it.
- Expose new context values: `impersonating: { id, name } | null`,
  `startImpersonation(biz)`, `stopImpersonation()`.
  - `startImpersonation` writes localStorage + sets state.
  - `stopImpersonation` clears localStorage + state.

### 2. `apps/web/src/app/[locale]/admin/page.tsx`
- `handleImpersonate(biz)`: call existing `/api/admin/impersonate` (keep audit log) →
  on success `startImpersonation({ id: biz.id, name: biz.name })` →
  `router.push("/{locale}/dashboard")`.
- On failure: toast, do **not** navigate, do **not** set state.
- Remove the local `impersonating` state and the admin-page orange banner (moves to dashboard).

### 3. `apps/web/src/app/[locale]/dashboard/layout.tsx`
- Render a global impersonation banner (business name + "Exit" / "חזרה לניהול") above
  `DashboardShell` when `impersonating` is set. Persistent until Exit (not a toast).
- Exit → `stopImpersonation()` + POST `/api/admin/stop-impersonate` + `router.push("/{locale}/admin")`.

### 4. `apps/api/src/routes/notifications.ts`
- Add `requireBusinessAccess` middleware after `requireAuth` on GET `/`.

### 5. Backend impersonation endpoints — unchanged
- `/api/admin/impersonate` and `/api/admin/stop-impersonate` remain audit-log-only.

## Data Flow

```
click "צפה כבעלים"
  → POST /api/admin/impersonate            (audit log)
  → startImpersonation(biz)                (localStorage + provider state)
  → router.push(/{locale}/dashboard)
  → business-provider yields impersonated businessId (super_admin only)
  → dashboard calls /api/businesses/:id/... hit target business
  → requireBusinessAccess super_admin bypass authorizes
  → full manage (read + write)
Exit:
  → stopImpersonation() + POST /api/admin/stop-impersonate
  → router.push(/{locale}/admin) → own context restored
```

## Error Handling

- Impersonation POST fails → toast, no navigation, no state change.
- Non-admin with stale/injected localStorage key → provider ignores and clears it; backend
  independently returns 403 on any business-scoped call.
- localStorage set but business later deleted → normal dashboard 404/empty handling applies.

## Testing

- **Unit (`business-provider`):** returns impersonated id when key set AND super_admin; returns
  `/me` id (ignores + clears key) when not super_admin.
- **Backend:** non-admin GET `/api/businesses/:otherId/notifications` → 403 (regression guard for
  the IDOR fix).
- **Manual:** admin clicks "View as owner" → lands in that business's calendar with its data →
  create/edit persists → banner Exit returns to `/admin` with own context restored.

## Out of Scope (YAGNI)

- Server-side scoped impersonation tokens.
- View-only / write-guard mode (decision: full manage).
- Impersonating individual users (only businesses).
- Broad audit of `availability` anon route beyond the confirmation done here.
