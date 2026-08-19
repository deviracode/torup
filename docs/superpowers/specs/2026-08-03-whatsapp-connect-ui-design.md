# WhatsApp Connect UI (Business Owner Token Control) — Design

**Date:** 2026-08-03
**Status:** Draft — awaiting review
**Related:** [Per-Tenant WhatsApp Sender Identity](./2026-08-03-per-tenant-whatsapp-identity-design.md) (backend, already implemented)

---

## Problem Statement

The backend now supports per-tenant WhatsApp: each business has its own `whatsapp_credentials` row (`phone_number_id` + `access_token`), and three endpoints exist under `/api/businesses/:businessId/whatsapp`:

- `GET /` → `{ connected: boolean, displayPhone: string | null, verifiedAt: string | null }` (masked — never returns the token)
- `PUT /` → body `{ phoneNumberId, accessToken, displayPhone? }` → returns the same masked shape
- `POST /test` → body `{ to }` → sends a test WhatsApp message; on success sets `verifiedAt`; returns `{ ok: true }`

**There is no web UI for a business owner to connect or manage their WhatsApp number.** This design adds that UI: a settings screen where the owner pastes their own credentials, sees connection/verification status, and sends a test message — so the owner controls their own token.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Placement | New **"whatsapp" tab** in dashboard settings, body **extracted to its own component** (`whatsapp-settings.tsx`) — the settings page is already 1081 lines |
| Flow scope | **Status + paste + test send** — uses all three backend endpoints |
| Onboarding help | **Short inline help text + external link** to Meta WhatsApp Manager |
| Token input | **Password field with reveal (show/hide) toggle**; token is write-only, never fetched back or rendered |
| Disconnect | **Out of scope** this iteration (no backend DELETE); owner overwrites by re-pasting |
| Verified state | **Connected + "unverified" hint** until a test send succeeds; uses the backend's `verifiedAt` field |

## Non-Goals

- No disconnect / delete-credentials UI (no backend DELETE endpoint yet).
- No Meta Embedded Signup / OAuth — manual paste only (matches the backend's manual-paste design).
- No new test framework for `apps/web` — the app has none today; verification is typecheck + build + manual flow driving (see Testing).
- No changes to the backend endpoints — they are already implemented and unchanged by this work.

---

## Section 1 — Component boundary & wiring

New component: `apps/web/src/components/dashboard/whatsapp-settings.tsx`. It is self-contained — owns its state, handlers, and API calls.

Changes to `apps/web/src/app/[locale]/dashboard/settings/page.tsx` are minimal:

1. Add `"whatsapp"` to the `Tab` union type (currently line 86).
2. Add `{ key: "whatsapp", label: t("whatsapp") }` to the `tabs` array (~line 424).
3. In the tab body, render `{tab === "whatsapp" && <WhatsAppSettings businessId={businessId} token={token} />}`.

No WhatsApp state, no `fetchTab` branch, and no handlers are added to `page.tsx`. This is a deliberate divergence from the inline `gcal` tab pattern, justified by the page's size (1081 lines) — the component keeps the page from growing further and gives the feature a clear, testable boundary.

**Props:** `businessId: string` and `token: string | undefined` — the same values the page already holds (`businessId` state, `token` from auth). The component calls the API via the existing `apiFetch` helper (`apps/web/src/lib/api.ts`), passing `token`, exactly as the page does elsewhere.

## Section 2 — Component internals (state & data flow)

State inside `WhatsAppSettings`:

- `status: WhatsAppStatus | null` where `WhatsAppStatus = { connected: boolean; displayPhone: string | null; verifiedAt: string | null }` — from `GET`.
- Form: `phoneNumberId: string`, `accessToken: string`, `displayPhone: string` (optional), `showToken: boolean` (reveal toggle), `editing: boolean` (whether the paste form is shown when already connected).
- `testTo: string` (destination for the test message).
- `loading`, `saving`, `testing` flags.

Data flow:

1. **On mount** (and when `businessId`/`token` become available) → `GET /api/businesses/:businessId/whatsapp` → set `status`.
2. **Save** → `PUT` with `{ phoneNumberId, accessToken, displayPhone: displayPhone || undefined }`. On success: clear `accessToken` from state immediately (do not retain the secret), set `editing = false`, refetch status, show a success message. Save is disabled unless both `phoneNumberId` and `accessToken` are non-empty (mirrors the backend's 400 validation).
3. **Test** → `POST /test` with `{ to: testTo }`. On success: refetch status (picks up the new `verifiedAt`), show "verified" success. On failure: the backend's 400 message ("check the token and phone number id" / "No WhatsApp number connected") surfaces through the existing error path.

## Section 3 — UI states

One panel, three states driven by `status`:

**A. Not connected** (`status.connected === false`, or `status === null` after load):
- Short help text: what connecting does (your messages send from your own WhatsApp number) + where to get the values, with an external link to Meta WhatsApp Manager (`https://business.facebook.com/wa/manage/`).
- Paste form: `phone_number_id` (text), `access_token` (password + reveal toggle), `display_phone` (optional text).
- **Save** button (disabled until required fields present).

**B. Connected, unverified** (`connected === true`, `verifiedAt === null`):
- Green "Connected" badge + masked `displayPhone` (or a generic "number connected" if `displayPhone` is null).
- Amber hint: "Not yet verified — send a test message to confirm it works."
- Test-send row: destination input (`testTo`) + **Send test** button.
- A "Replace credentials" link/button that reveals the paste form (`editing = true`) to overwrite.

**C. Connected & verified** (`verifiedAt` set):
- "Connected & verified ✓" badge + `displayPhone` + the verified timestamp (localized).
- Test-send row still available (re-test anytime).
- "Replace credentials" affordance.

The token input never displays a stored value — `GET` never returns it, and "Replace credentials" starts from an empty field. The reveal toggle only affects what the owner is currently typing.

## Section 4 — Security, errors, i18n

**Security:**
- The `access_token` travels only on `PUT` (write path). It is never fetched back (`GET` is masked) and never rendered from server data.
- The component drops `accessToken` from state right after a successful save.
- Reveal toggle is a display convenience on the owner's own input, not a fetch of stored data.

**Errors:**
- `apiFetch` throws on non-2xx; the component surfaces the message (inline message area consistent with the page's `message` pattern, or a toast if the component uses `sonner` like `use-api.ts`). Choose the inline-message approach to match the settings page's existing feedback style.
- Client-side: Save disabled until required fields present; Send-test disabled until `testTo` present.

**i18n:**
- Tab label via `t("whatsapp")` — add the `whatsapp` key to the `dashboard` message namespace for each locale (he/en/ar) alongside the other tab labels.
- Body copy follows the neighboring `gcal` tab's pragmatic precedent (inline Hebrew), for visual/tone consistency with the adjacent tab. If full localization of body copy is desired later, it is an additive change.

## Testing

`apps/web` has **no unit-test framework** (verified: no vitest/jest/testing-library, zero `*.test.*` files). Introducing one for a single component is out of scope. Verification for this work:

1. **Typecheck:** `npm run type-check` (`tsc --noEmit`) in `apps/web` — zero errors, including the new `Tab` union member and component props.
2. **Build:** `next build` succeeds.
3. **Manual flow driving** (the real verification for a UI feature): with a running app + a business login, exercise all three states —
   - Not-connected → paste credentials → Save → status flips to connected/unverified.
   - Unverified → Send test to a real number → success flips to verified with timestamp; a deliberately-wrong token → error surfaces, stays unverified.
   - Confirm via browser devtools/network that no `GET` response and no rendered DOM ever contains the `access_token`.

## Error Handling Summary

- `GET` fails → show a non-blocking error, treat as not-connected (owner can still attempt to connect).
- `PUT` 400 (missing fields) → shouldn't happen given client-side gating, but surface the message if it does.
- `POST /test` 400 (bad credentials / not configured) → surface the backend message; leave `verifiedAt` unchanged.
- Network/401 → handled by the existing `apiFetch`/auth flow (same as every other settings call).
