# Per-business WhatsApp template-approval flags — design

## Context

Three notification paths (`sendApprovalNotification`, `sendRejectionNotification`,
`sendManagerNotification` in `apps/api/src/services/notifications.ts`) each
decide whether to use an approved Meta message template (which bypasses
WhatsApp's 24-hour freeform-message window entirely) or fall back to
freeform text (which silently fails once 24h have passed since the
recipient's last inbound message — confirmed via production logs today,
error `131047`). This decision is currently gated by three **global**
environment variables:

- `WHATSAPP_APPROVAL_TEMPLATE_ENABLED`
- `WHATSAPP_REJECTION_TEMPLATE_ENABLED`
- `WHATSAPP_MANAGER_TEMPLATE_APPROVED`

This is architecturally wrong for Torup as a multi-tenant SaaS platform:
Meta template approval is inherently **per-business** (each business's
WhatsApp Business Account registers and gets its own templates approved
independently — the platform already models WhatsApp sending credentials
per-tenant via the `whatsapp_credentials` table). A global env var can't
represent "business A's template is approved, business B's isn't," and
already caused a real incident today: flipping the global approval-template
flag on (believing it was approved) broke approval notifications for
*every* business, when in fact the specific business's template was still
in Meta review.

Confirmed via WhatsApp Business Platform documentation (Meta's official
policy and developer docs): outside the 24h window, approved templates are
the *only* way to reach a user — this is a hard platform rule, not a
Torup implementation choice, so there's no alternative to "get the
template approved per business, and track that state per business."

## Decisions (confirmed with user)

- Flags live on `whatsapp_credentials` (per-tenant WhatsApp account config),
  not `businesses` — matches how the rest of that table already models
  per-tenant WhatsApp Business Account state (phone number ID, access
  token, active status).
- Settable only via the super-admin panel (`/admin`) — not exposed to
  business owners' own dashboard. Verifying real Meta approval status is
  an operational detail the platform operator manages, not something a
  business owner needs to understand or touch.
- The three global env vars are removed entirely once this ships — no
  fallback, to prevent this exact confusion (global state assumed to mean
  business-specific state) from recurring.

## Schema

New migration adding three columns to `whatsapp_credentials`, matching
the table's existing plain-boolean style (`is_active`):

```sql
ALTER TABLE whatsapp_credentials
  ADD COLUMN approval_template_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN rejection_template_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN manager_template_approved BOOLEAN NOT NULL DEFAULT false;
```

All default `false` — safe (freeform-first) for every business until an
admin explicitly flips one on after confirming real Meta approval.

## Backend changes

### `apps/api/src/modules/whatsapp/whatsapp-credentials.repository.ts`

- Add the three columns to `CredentialRow` and the `COLUMNS` select
  constant.
- Add `updateTemplateFlags(businessId, flags: Partial<{approvalTemplateApproved, rejectionTemplateApproved, managerTemplateApproved}>)`
  — plain update, no encryption needed (these are booleans, unlike
  `access_token`/`app_secret`/`verify_token`).

### `apps/api/src/modules/whatsapp/whatsapp-credentials.service.ts`

- `resolveForBusiness`'s returned `WhatsAppCredential` gains the three
  flags, read from the same row already being fetched.
- Add a passthrough `updateTemplateFlags(businessId, flags)` method for
  the new admin route to call.

### `apps/api/src/services/whatsapp.ts`

- `WhatsAppCredential` type gains:
  ```ts
  export type WhatsAppCredential = {
    phoneNumberId: string;
    accessToken: string;
    approvalTemplateApproved?: boolean;
    rejectionTemplateApproved?: boolean;
    managerTemplateApproved?: boolean;
  };
  ```

### `apps/api/src/services/notifications.ts`

All three functions currently gate on `process.env.X`. Replace with a
credential-driven check. `sendManagerNotification` already resolves the
credential before deciding template-vs-freeform, so only its `useTemplate`
line changes. `sendApprovalNotification`/`sendRejectionNotification`
currently check the env var *before* fetching the appointment at all
(the appointment fetch — and credential resolution — only happens inside
the `if (useTemplate)` block) — these two need restructuring so the
appointment is fetched unconditionally first, then the credential (and
its flag) determines whether the template branch is attempted:

```ts
// sendApprovalNotification — new shape
export async function sendApprovalNotification(appointmentId: string) {
  const supabase = createServiceClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, business_id, customer_id, start_time, " +
      "customers(id, name, phone, language_preference), " +
      "services(name_he, name_ar, name_en), " +
      "businesses(name)"
    )
    .eq("id", appointmentId)
    .single();

  if (appointment) {
    const apt = appointment as unknown as AppointmentWithDetails;
    const customer = apt.customers;
    const service = apt.services;
    if (customer?.phone && service) {
      const credential = await resolveBusinessCredential(apt.business_id);
      if (credential?.approvalTemplateApproved) {
        // ...existing template-send + logNotification + return block, unchanged...
      }
    }
  }
  return sendAppointmentNotification(appointmentId, "approval");
}
```

Same restructuring pattern for `sendRejectionNotification` (its rebook_url
freeform-fallback tail is untouched). `sendManagerNotification` only
changes `const useTemplate = process.env.WHATSAPP_MANAGER_TEMPLATE_APPROVED === "true";`
to reading `credential?.managerTemplateApproved` — but since credential is
resolved *inside* the try block there today, the flag read needs to move
to right after that resolution, before the `if (!credential) {...} else if (useTemplate)`
branch.

### New admin endpoint

`apps/api/src/routes/admin.ts` — add, alongside the existing
`PATCH /businesses/:id`:

```ts
router.patch("/businesses/:id/whatsapp-template-flags", async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await whatsappCredsSvc().updateTemplateFlags(req.params.id as string, req.body));
  } catch (e) { next(e); }
});
```

using the existing `createWhatsAppCredentialsService`/`createWhatsAppCredentialsRepo`
factories (already used elsewhere, e.g. `apps/api/src/routes/whatsapp-credentials.ts`)
— already gated by the router-level `requireAuth, requireRole("super_admin")`.

Also extend `admin.repository.ts`'s `findBusinesses` select to join the
three flags (matching the existing `subscriptions(status, plan_id, plans(name))`
join pattern), so the admin business list can display current flag state
without an extra round-trip:

```ts
.select("*, subscriptions(status, plan_id, plans(name)), whatsapp_credentials(approval_template_approved, rejection_template_approved, manager_template_approved)")
```

### Admin UI (`apps/web/src/app/[locale]/admin/page.tsx`)

Add three checkboxes to the business edit view (alongside the existing
`contact_phone` field), calling the new
`PATCH /businesses/:id/whatsapp-template-flags` endpoint on change.

## Migrating the one business affected today

`business_id = 018a5da3-b020-4854-bd8a-d1bb62b65bdf` currently benefits
from `WHATSAPP_MANAGER_TEMPLATE_APPROVED=true` (set globally today as an
immediate stopgap). Once this ships, set that business's
`manager_template_approved = true` via the new admin UI, then remove the
global env var from Railway.

## Out of scope

- Any change to reminder notifications (`sendCustomerReminderTemplate`) —
  already unconditionally uses an approved template with no freeform
  fallback; not part of this gating mechanism.
- A dashboard/in-app notification channel as a WhatsApp backstop —
  discussed as a possible future addition, not part of this fix.
- Registering `appointment_rejected_he/ar` in Meta — external prerequisite,
  unrelated to this architectural change (the flag/column exists either way).

## Verification

1. Unit tests in `apps/api/src/__tests__/approval-notifications.test.ts`
   and a new manager-notification test file, extending the existing
   mock patterns: credential mock gains the three flag fields; tests
   cover each function using the template when its specific flag is
   `true` and falling back to freeform when `false`/unset — per business,
   not globally (i.e. one test confirms business A's `true` flag doesn't
   affect business B's send).
2. `pnpm --filter @torup/api test` — full suite passes.
3. `pnpm build` — full monorepo build passes.
4. Manual check: toggle a flag via the new admin endpoint for a test
   business, confirm `resolveBusinessCredential` reflects it on the next
   call.
