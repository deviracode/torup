# Customer approval/rejection notification fix — design

## Context

A business manager reported that customers sometimes don't receive the
WhatsApp notification telling them their appointment request was
approved or rejected. Her initial framing ("happens for appointments
booked less than 24 hours before their start time") turned out to be a
red herring — investigation first found and then ruled out an unrelated
race with an auto-cancel sweep, because she clarified the failures also
happen for appointments booked well in advance, and are unrelated to how
close the appointment itself is to starting.

Root cause: customer-facing approval/rejection notifications are sent as
freeform WhatsApp text messages (`sendWhatsAppMessage`,
`apps/api/src/services/whatsapp.ts`). Per Meta's WhatsApp Cloud API
rules, freeform text can only be delivered within 24 hours of the
**customer's last inbound message** to the business — not 24 hours
relative to the appointment. If the manager takes longer than 24 hours
to review and act on a booking (more likely, not less, for appointments
that aren't urgent), Meta rejects the send.

The failure is completely silent: `sendWhatsAppMessage` catches the
Meta API error and returns `null`; `sendAppointmentNotification` logs a
`"failed"` row to `notifications_log` but never throws; and nothing
downstream checks that result — the manager is unconditionally told
"customer will be notified" regardless of whether it actually happened.
This exact failure class (Meta error 131047, "outside the 24h window")
already bit this codebase once before for a different notification type
(manager booking alerts — see the comment at
`apps/api/src/services/notifications.ts:613-615` referencing "business
018a5da3..., June 2026").

An approved Meta template for customer-approval messages
(`appointment_confirmed_he`/`appointment_confirmed_ar`) already exists
in code (`sendCustomerApprovalTemplate`, `whatsapp.ts`) and bypasses the
24h window entirely — but it's gated behind an opt-in env var
(`WHATSAPP_APPROVAL_TEMPLATE_ENABLED`) that's currently unset, so it's
never actually used. No equivalent template exists for rejections, and
none is registered in Meta yet.

**Scope:** this fix covers customer-facing approval/rejection
notifications only. A related finding — the manager's own "new booking
pending approval" alert also runs on an unregistered-template freeform
fallback (`manager_new_booking` template also not approved in Meta) —
is explicitly out of scope, left for a separate fix.

## Decisions (confirmed with user)

- Approval template (`appointment_confirmed_he/ar`) is already approved
  in Meta — safe to switch to it as the default path immediately.
- No rejection template exists in Meta yet — build the code path now,
  keep it off until registered; don't block this fix on external Meta
  approval.
- Manager-alert visibility (the `manager_new_booking` template gap) is
  out of scope for this fix.

## Changes

### 1. `apps/api/src/services/notifications.ts` — `sendApprovalNotification`

Currently:
```ts
const useTemplate = process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED === "true";
```
Change to default-on (opt-out instead of opt-in), since the template is
confirmed live and strictly more reliable than freeform:
```ts
const useTemplate = process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED !== "false";
```
No other logic in this function changes — the template branch already
exists and works; this just makes it the default path taken.

### 2. `apps/api/src/services/whatsapp.ts` — new `sendCustomerRejectionTemplate`

Add a new function mirroring `sendCustomerApprovalTemplate` exactly in
structure (same dev-mode short-circuit, same Graph API call shape, same
error handling), for a template named `appointment_rejected_he` /
`appointment_rejected_ar` (Arabic/other-language split, matching the
existing convention). Takes `{ customerName, serviceName, date, time }`
as body parameters — same shape as the approval template, no `rebook_url`
support in this first version (see note below).

**Known gap, not addressed in this fix:** the current freeform rejection
message includes a clickable `rebook_url` link, and has two variants
(`rejection_slot_taken` vs `rejection_manual`) with different copy. The
template scaffold here is a single generic template with no URL button.
Whoever registers the Meta template should decide whether to add a URL
button component and/or split into two templates — that's a Meta
Business Manager decision, not something to guess at in code. Until
then, enabling this template means rejected customers get a plain
notification without the rebook link.

### 3. `apps/api/src/services/notifications.ts` — `sendRejectionNotification`

Add the same opt-in template branch pattern as `sendApprovalNotification`
(opt-in, not opt-out, since this template isn't registered yet):
```ts
const useTemplate = process.env.WHATSAPP_REJECTION_TEMPLATE_ENABLED === "true";
```
When enabled, calls `sendCustomerRejectionTemplate` with appointment/
customer/service data (fetched the same way `sendApprovalNotification`
already does it). When disabled (default), falls through to the
existing freeform path unchanged.

### 4. `apps/api/src/services/appointment-actions.ts` — surface notification result

`approveAppointment` and `rejectAppointment` currently `.catch()` the
notification call and discard its result entirely. Capture the
`{sent, failed}` result and include it in the returned object:

```ts
// approveAppointment
const notifyResult = await sendApprovalNotification(appointmentId).catch((err) => {
  console.error("[Notification] approval failed:", err);
  return { sent: false, failed: true };
});
// ...
return { approved: appointmentId, rejected: rejectedIds, customerNotified: notifyResult.sent };
```

```ts
// rejectAppointment
const notifyResult = await sendRejectionNotification(appointmentId, "manual").catch((err) => {
  console.error("[Notification] manual rejection failed:", err);
  return { sent: false, failed: true };
});
// ...
return { rejected: appointmentId, customerNotified: notifyResult.sent };
```

This does not change error/rollback behavior — a failed customer
notification never fails the approve/reject action itself, only adds
visibility. Both API routes in `apps/api/src/routes/appointments.ts`
already forward this return value as JSON unchanged, so no route
changes are needed there.

### 5. `apps/api/src/routes/webhooks.ts` — honest manager confirmation message

`handleManagerResponse` currently sends the manager a hardcoded success
message *before/regardless of* the actual notification outcome. Reorder
so the notification is sent first, and the manager's confirmation
message reflects the real result:

```ts
if (action === "approve") {
  await supabase.from("appointments").update({ status: "confirmed" }).eq("id", appointmentId);
  const result = await sendApprovalNotification(appointmentId);
  const managerMsg = result.sent
    ? "✅ התור אושר! הלקוח יקבל הודעה."
    : "✅ התור אושר, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות.";
  await sendWhatsAppMessage(managerPhone, managerMsg);
} else {
  await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);
  const result = await sendRejectionNotification(appointmentId, "manual");
  const managerMsg = result.sent
    ? "❌ התור נדחה. הלקוח יקבל הודעה."
    : "❌ התור נדחה, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות.";
  await sendWhatsAppMessage(managerPhone, managerMsg);
}
```

## Out of scope

- **Dashboard UI surfacing of `customerNotified: false`.** There is no
  toast/notification library in `apps/web` on this branch (no `sonner`
  dependency, no equivalent — confirmed by search), and the current
  `handleApprove`/`handleReject` in
  `apps/web/src/app/[locale]/dashboard/page.tsx:374-388` silently
  swallow all errors (`.catch(() => {})`), so there's no existing
  pattern to extend either. Introducing a new UI dependency/pattern as
  a side effect of this bug fix is out of scope. The `customerNotified`
  field is still added to the API response (see #4) so it's available
  for future UI work, but no frontend changes ship in this fix — the
  WhatsApp-side honest messaging (#5), which the manager already relies
  on day-to-day, is the actual fix she'll see.
- Registering the rejection template (and deciding its final shape —
  one vs. two templates, URL button for rebook link) in WhatsApp
  Business Manager — external, non-code prerequisite.
- The `manager_new_booking` template / manager-alert visibility gap —
  separate, related bug, explicitly deferred.
- Any retry/queueing mechanism for failed sends — out of scope; this
  fix is about correctness of the reliable path (approval) and honesty
  about the unreliable one (rejection), not building delivery guarantees.

## Verification

1. Unit tests in `apps/api/src/__tests__/` (extending existing
   WhatsApp-mock patterns) covering:
   - `sendApprovalNotification` uses the template path when the env var
     is unset (new default) and when explicitly `"true"`; falls back to
     freeform only when explicitly `"false"`.
   - `sendRejectionNotification` uses freeform by default; uses the new
     template path only when `WHATSAPP_REJECTION_TEMPLATE_ENABLED=true`.
   - `approveAppointment`/`rejectAppointment` return `customerNotified:
     false` when the mocked send fails, `true` when it succeeds, and in
     both cases still return success for the approval/rejection itself.
   - `handleManagerResponse` sends the correct (success vs. failure)
     message to the manager based on a mocked notification result.
2. `pnpm --filter @torup/api test` — full suite passes.
3. `pnpm build` — full monorepo build passes.
4. Manual check: with `WHATSAPP_APPROVAL_TEMPLATE_ENABLED` unset in a
   local `.env`, trigger an approval in dev mode and confirm the console
   log shows the template-path dev-mode message (`sendCustomerApprovalTemplate`'s
   `console.log`), not the freeform one.
