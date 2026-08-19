# Per-Tenant WhatsApp Sender Identity — Design

**Date:** 2026-08-03
**Status:** Draft — awaiting review
**Related:** [SaaS Tenant Isolation & Layered Architecture](./2026-07-08-saas-tenant-and-layering-design.md)

---

## Problem Statement

The tenant-isolation effort has hardened the data layer (RLS, per-request user client, layered architecture). One core piece is still **not tenant-safe: the WhatsApp sender identity**.

Today WhatsApp credentials are a single global secret in the app, not a tenant-scoped resource:

- `apps/api/src/services/whatsapp.ts` reads module-level env `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`. **All tenants send from one platform WhatsApp number.**
- Inbound webhooks (`apps/api/src/routes/webhooks.ts`) resolve the tenant by matching the sender phone against `businesses.phone` — fragile and does not scale to per-tenant numbers.
- There is no table, no RLS, no per-business record of a WhatsApp identity. It is invisible to the tenant-isolation model.

**Goal:** each business brings its own WhatsApp Business number (BYO). Messages send from the tenant's own number using the tenant's own token; inbound messages route to the correct tenant by the number that received them.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Sender identity model | **BYO per-tenant number** — each business connects its own WhatsApp number + token |
| Credential storage | **DB table `whatsapp_credentials`**, mirroring the existing `google_calendar_tokens` precedent |
| Onboarding | **Manual paste** — owner pastes `phone_number_id` + `access_token` into dashboard settings |
| Inbound routing | **By `phone_number_id`** from the webhook payload, resolved in **middleware** |
| Token at rest | **Plaintext `TEXT`**, protected by RLS + service-role-only reads (same as `google_calendar_tokens`) |
| Migration fallback | **No fallback** — a business with no credentials cannot send WhatsApp until it connects |

## Non-Goals

- Not rewriting the notifications/reminders subsystem into full 3-layer architecture — only thread `businessId` through so credentials can be resolved.
- Not touching non-WhatsApp channels (SMS/email).
- Not building Meta Embedded Signup / OAuth onboarding (manual paste chosen for the first iteration).
- Not encrypting the token at rest in this iteration (plaintext + RLS, consistent with existing precedent).

---

## Section 1 — Data model

New table `whatsapp_credentials`, one row per business, shaped after `google_calendar_tokens`:

```sql
CREATE TABLE whatsapp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  phone_number_id TEXT NOT NULL UNIQUE,   -- Meta WABA phone number id; also the inbound webhook routing key
  access_token TEXT NOT NULL,             -- plaintext, protected by RLS + service-role-only reads
  display_phone TEXT,                     -- human-readable number, for UI display
  verified_at TIMESTAMPTZ,                -- set after a successful test send
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_credentials_phone_number_id
  ON whatsapp_credentials(phone_number_id);
```

- `business_id UNIQUE` — one WhatsApp identity per business.
- `phone_number_id UNIQUE` — one Meta number belongs to exactly one business; it is the inbound webhook routing key.
- RLS policies (same shape as other tenant tables):
  - Owner/staff of the business may `SELECT` and `INSERT`/`UPDATE` **their own** row (scoped by `business_id` via `business_members`).
  - No cross-tenant access.
  - The raw `access_token` is never returned to the browser — the read controller returns a masked view (see Section 4).
- The **sending path** (webhooks, cron) reads via the **service-role** client, since those contexts have no user JWT.

## Section 2 — Sending path (credential resolution + injection)

`services/whatsapp.ts` is an **external API adapter** (Meta HTTP client), not a repository. It is not forced into repo shape. The change is a signature refactor: it stops reading module-level env and instead receives a resolved credential.

New module layout:

```
apps/api/src/modules/whatsapp/
  whatsapp-credentials.repository.ts   # DATA ACCESS for whatsapp_credentials
  whatsapp-credentials.service.ts      # LOGIC: resolve for send, mask for read, test-send → verified_at
apps/api/src/services/whatsapp.ts      # ADAPTER: Meta HTTP calls; each fn takes a credential
```

Repository methods:

- `getByBusinessId(businessId)` — **service-role** read; returns the full credential (incl. token) for sending. Used by webhooks/cron/notification fan-out.
- `getByPhoneNumberId(phoneNumberId)` — **service-role** read; resolves inbound webhook → business + credential.
- `upsert(userClient, businessId, { phoneNumberId, accessToken, displayPhone })` — **user client** (RLS-scoped) write from the settings endpoint.

Adapter changes:

- New type `WhatsAppCredential { phoneNumberId: string; accessToken: string }`.
- Every `send*` function in `whatsapp.ts` gains `credential: WhatsAppCredential` as its first argument and drops the module-level `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` consts. `WHATSAPP_API_URL` stays.
- Service resolver `resolveCredentialForBusiness(businessId)` → repo `getByBusinessId` → credential or `null`.
- **No credentials → no send.** The send path skips (returns `null`) and logs a clear "WhatsApp not configured for business X" message. Existing callers already tolerate a `null` return.
- The current dev-mode behaviour (env absent → console log, no real send) is preserved **only** for local development where no credential is resolved.

Callers (`services/notifications.ts`, reminder dispatch, approval flow) must thread `businessId` through to resolve and pass the credential. This is the minimum change — no subsystem rewrite.

## Section 3 — Inbound webhook routing

Add middleware on `POST /api/webhooks/whatsapp`:

1. Extract `entry[0].changes[0].value.metadata.phone_number_id` from the payload.
2. `repository.getByPhoneNumberId(phoneNumberId)` (service-role) → `business_id` + credential.
3. No match → respond `200` and drop the event (ack Meta, ignore). Never 4xx (Meta retries/backs off on error).
4. Attach `{ businessId, credential }` to the request context for the handlers.

This **replaces** the fragile `businesses.phone` match currently used to resolve the tenant. Manager-identity verification (is this phone the business owner?) still compares against `businesses.phone`, but the **tenant itself** is now resolved by the number that received the message. All webhook reply-sends (`handleManagerResponse`, `handleButtonResponse`) use the resolved tenant credential rather than the global env sender.

## Section 4 — Onboarding (manual paste)

- Dashboard settings screen: owner pastes `phone_number_id` and `access_token` (and optional `display_phone`).
- `POST /api/businesses/:businessId/whatsapp-credentials` → controller → service → repository `upsert` via the **user client** (RLS-scoped; forging `:businessId` yields RLS denial per the tenant-isolation model).
- `GET /api/businesses/:businessId/whatsapp-credentials` returns a **masked** view only: `{ connected: boolean, displayPhone, verifiedAt }`. The raw `access_token` is never sent to the browser.
- Optional **test send**: `POST .../whatsapp-credentials/test` sends a message via the adapter using the just-saved credential; on success sets `verified_at`.

## Section 5 — Migration / rollout

- Sender source moves from env → table. Platform env vars `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are **retired as the sender identity**.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` remain — they are platform-level (webhook verification challenge and signature), not per-tenant sender secrets.
- **No fallback:** a business with no `whatsapp_credentials` row cannot send WhatsApp until it connects. Live tenants must onboard, or WhatsApp goes dark for them at cutover.
- **Optional one-time backfill:** a script seeds credentials for known existing tenants (e.g. the current single live tenant) from the retiring env values, so nothing breaks at cutover.

## Section 6 — Layering scope (explicit)

| Component | Treatment |
|---|---|
| `whatsapp_credentials` module | ✅ Fully layered — controller / service / repository |
| `services/whatsapp.ts` adapter | ✅ Signature change only — takes a resolved credential; not a repo |
| notifications / reminders senders | ➖ Thread `businessId` only — no full 3-layer rewrite |
| non-WhatsApp channels (SMS/email) | ❌ Untouched |

---

## Testing

- **Repository:** `getByPhoneNumberId` resolves the correct business; unknown id → null.
- **RLS isolation:** a user of business A cannot `SELECT`/`UPSERT` business B's `whatsapp_credentials` (extend the existing cross-tenant isolation integration test pattern).
- **Masked read:** the `GET` endpoint never returns `access_token`.
- **Sending:** with no credential, `send*` returns null and does not hit Meta; with a credential, the adapter uses the passed token/phone_number_id (assert the outbound request, not env).
- **Webhook routing:** an inbound payload with business B's `phone_number_id` resolves to business B; an unknown `phone_number_id` is dropped with a 200.
- **Test send:** a successful test send sets `verified_at`.

## Error Handling

- Missing credential on a send → skip + structured log ("WhatsApp not configured for business X"), return null. No throw that breaks the caller.
- Unknown `phone_number_id` on inbound → 200 + drop.
- Meta API error on send → existing behaviour retained (log HTTP status + Meta error code, return null).
- Test send failure → 4xx to the dashboard with the Meta error surfaced; `verified_at` left unset.
