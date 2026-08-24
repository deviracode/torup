# Lessons learned: SOMAR Eyebrow Art WhatsApp bot not responding

## Symptom

A newly connected business ("SOMAR Eyebrow Art", phone `0552738612`) sent and
received zero WhatsApp messages through the bot. No errors were visible
anywhere in the dashboard — the connection showed as "מחובר" (connected).

## Root causes (found and fixed in this order)

Four independent, stacked failures — each one hid the next. Fixing #1 alone
looked like it should have worked; it didn't, because #2–#4 were still
broken.

1. **Empty webhook field subscription** on the business's own Meta app —
   the app's Webhooks product had a `whatsapp_business_account` topic with
   zero fields subscribed. Fixed via `devtools_webhook_manage update_fields`.

2. **Silent message-drop on `phone_number_id` mismatch** — the webhook
   handler already had a guard comparing the inbound payload's
   `phone_number_id` to the stored credential's, but on mismatch it just
   `continue`d with no log. This made every prior failure indistinguishable
   from "no message ever arrived." Fixed by adding a `console.warn` with
   both values (`services/whatsapp-agent/src/index.ts`).

3. **Wrong App Secret stored for the business** — the phone number's real
   WhatsApp Business Account (WABA) webhook events were, at the time,
   arriving signed by a *different* Meta app than the one whose secret was
   pasted into the dashboard's WhatsApp Settings tab. Every inbound POST
   failed `verifySignature()` and was silently rejected with `403`, logged
   only as `"Invalid webhook signature for business ..."` — a log line that
   is easy to miss unless you're specifically searching for it.

4. **The WABA was never subscribed to any app at the Graph API level** —
   this was the real, final root cause. Meta has two *separate* concepts
   that both have to be correct, and neither the App Dashboard nor Business
   Settings UI expose the second one clearly:
   - The **App's** webhook config (callback URL + subscribed fields) — set
     in App Dashboard → Webhooks. This is what `devtools_webhook_manage`
     manages, and what the (misleading) "Webhook Test" button in the App
     Dashboard exercises — **test sends succeed even when this is
     broken**, because they're synthetic and bypass real delivery.
   - The **WABA's** `subscribed_apps` edge — a list of which app(s) Meta
     will actually deliver that WABA's real events to. This is normally
     set automatically by Meta's **Embedded Signup** OAuth flow. Since this
     platform uses a manual paste-your-own-credentials form instead of
     Embedded Signup, this step was *never performed at all* — confirmed
     by `GET /{waba-id}/subscribed_apps` returning `{"data":[]}`.
   Fixed with a direct Graph API call:
   `POST /{waba-id}/subscribed_apps?access_token=<system-user-token>`.

## Why it took so long to find

- Every one of the four failures is **silent by default** — no dashboard
  banner, no exception, no visible error to the business owner or admin.
- The App Dashboard's built-in "Webhook Test" send **does not exercise the
  WABA subscription at all**, so it gives false confidence that the pipe is
  connected end-to-end when it isn't.
- Meta's WhatsApp Manager "Messages received: 0" insights panel has a
  **fixed historical date window that does not include "today"** — so a
  fresh test message sent minutes ago won't show up there, and it's easy to
  misread that as proof of failure when it's actually just a stale filter.
- Two different Meta Apps existed with similar/confusing names
  ("TorupStaging" vs. the business's own dedicated app) and it was easy to
  assume "whichever app is delivering the webhook right now" is the
  intended long-term one, rather than recognizing it as evidence of a
  misconfiguration that needed correcting at the source.

## Standing gaps (not fixed, worth doing later)

- **No automated check** that a business's stored `app_secret` actually
  matches the app whose webhook is delivering its messages — this class of
  bug will recur for the next manually-onboarded business unless caught by
  a checklist (see the new skill) or replaced by Embedded Signup.
- **No automated check** that a WABA's `subscribed_apps` includes the
  expected app — same risk as above.
- Consider building Meta's **Embedded Signup** flow to replace the manual
  paste form entirely. It performs steps 3 and 4 above automatically as
  part of OAuth, which would eliminate this entire class of bug for every
  future business, not just retroactively fix this one.
