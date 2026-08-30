---
name: connect-whatsapp-business
description: Use when connecting a new business's WhatsApp Cloud API number to Torup, or when a connected business's bot isn't sending/receiving messages. Walks through every layer Meta requires (App webhook config, App Secret match, WABA subscription) that the dashboard's manual paste form does not verify or set up automatically.
metadata:
  author: torup
  version: "1.0"
---

# Connecting a new business's WhatsApp number

Torup's dashboard (Settings → WhatsApp) is a **manual paste form**, not
Meta's Embedded Signup OAuth flow. That means none of the automatic wiring
Embedded Signup normally does happens for you — you have to do it by hand,
in the right order, or the bot will silently receive nothing. See
`docs/superpowers/plans/2026-08-24-whatsapp-onboarding-lessons-learned.md`
for the full incident this skill is based on.

## Checklist

Work through these in order. Each layer can look "done" while a later one
is still broken — don't stop at the first green checkmark.

### 1. Identify the real WABA and App

- [ ] Get the business's phone number and its **Phone Number ID** from
      Meta Business Manager → WhatsApp Manager → Phone numbers.
- [ ] Get the **WABA ID** that phone number actually belongs to (shown on
      the same page). Do not assume it's the WABA with a matching name —
      confirm the ID.
- [ ] Get the **App ID** that should own this business
      (`devtools_app_list` → match by name/business). This should be a
      dedicated app for this business, not a shared/staging app.
- [ ] Get that app's **App Secret** from App Dashboard → Settings → Basic
      → App Secret → Show. Copy the actual value — do not assume any
      other app's secret will work, even if it's currently the one
      delivering webhooks (that itself may be a misconfiguration).

### 2. Store credentials in Torup

- [ ] In the dashboard, Settings → WhatsApp, paste: Phone Number ID,
      Access Token (System User token with `whatsapp_business_messaging` +
      `whatsapp_business_management`), **App Secret from step 1** (not
      from a different app), and a Verify Token of your choosing.
- [ ] Save.
- [ ] Saving attempts to **auto-submit the app's required message
      templates** (`appointment_reminder_he/ar`, `appointment_confirmed_he/ar`,
      `appointment_rejected_he/ar`) to this business's WABA — needed to
      message customers outside WhatsApp's 24h conversation window (e.g.
      manual bookings, reminders sent days out). This is fire-and-forget and
      never blocks the save; check API logs for
      `[WhatsApp] Template provisioning for business <id>` to confirm it ran.
  - **In practice, auto-resolution of the WABA id from just the phone
    number + System User token frequently fails** — confirmed in production
    (`me/businesses` came back empty for a real, correctly-scoped System
    User token; there is no reliable phone-number → WABA reverse lookup on
    the Graph API for that token shape). If the log line above shows
    `wabaId: null` / "Could not resolve WABA id", **this is expected, not a
    bug** — the auto-provisioning attempt failed silently, so you must run
    the backfill manually with the WABA id you already collected in step 1:
    ```
    cd apps/api && pnpm backfill:whatsapp-templates --business-name "<business name>" --waba-id <waba-id>
    ```
    Safe to re-run — "already exists" counts as success. Point
    `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` at the right environment
    first per `docs/ENVIRONMENTS.md`.
  - Either way, check WhatsApp Business Manager → Message Templates for
    that WABA to confirm Meta actually accepted the templates for review
    (submission ≠ approval — that's async on Meta's side and can take
    minutes to longer). Expect `appointment_rejected_he/ar` to potentially
    fail with a Meta "Invalid parameter" (subcode 2388299) — seen on a real
    submission and not yet root-caused; the other 4 templates are not
    affected by whatever's wrong with those two.

### 3. App-level webhook config

- [ ] `devtools_webhook_list list_subscriptions` for the App ID — confirm
      a `whatsapp_business_account` topic exists with `messages` in its
      fields.
- [ ] If missing/empty: `devtools_webhook_manage subscribe` with
      `callback_url = https://<production-whatsapp-service>/webhook/<businessId>`,
      `fields: ["messages"]`, and the **same** verify token stored in step 2.
- [ ] `devtools_webhook_test test_send` with `field: "messages"` — confirm
      `success: true` AND check Railway logs
      (`mcp__railway__get_logs`, `log_type: "http"`, filter `path`) for a
      `POST /webhook/<businessId> 200` (not `403`).
  - **A 403 here means the App Secret doesn't match the app actually
    delivering events** — go back to step 1, re-verify you copied the
    secret from the correct app.
  - **`test_send` succeeding is not proof real messages will arrive** —
    it's a synthetic event that bypasses the WABA subscription entirely.
    You must still complete step 4.

### 4. WABA-level subscription (the step Embedded Signup normally does for you)

This is the step most likely to be missing, because nothing in the
dashboard UI or App Dashboard surfaces it.

- [ ] Check current state:
      `GET https://graph.facebook.com/v21.0/{waba-id}/subscribed_apps?access_token={system-user-token}`
  - If `data` is empty (`{"data":[]}`), **no app receives this WABA's
    real events, full stop** — regardless of anything configured in
    steps 1–3.
- [ ] Subscribe the correct app:
      `POST https://graph.facebook.com/v21.0/{waba-id}/subscribed_apps?access_token={system-user-token}`
  - The access token must belong to a System User with admin/full-control
    access to that WABA (Business Settings → System Users → assign the
    WABA asset first if not already done).
- [ ] Re-run the `GET` to confirm the response now lists the correct
      `app_id` under `whatsapp_business_api_data`.

### 5. Real end-to-end verification

- [ ] Ask the business owner (or use a real test phone) to send an actual
      WhatsApp message to the connected number.
- [ ] Check Railway HTTP logs for a `POST /webhook/<businessId> 200`
      arriving within a few seconds.
- [ ] Check Railway deploy/app logs for `Parsed messages: 1` and confirm
      **no** `phone_number_id mismatch` warning follows it.
- [ ] Confirm the bot actually replies in WhatsApp.

Do not consider the business "connected" until step 5 passes with a real
message — every earlier step can pass in isolation while the pipeline as a
whole is still broken.

## Common false-positive signals (don't trust these alone)

- **Dashboard shows "מחובר ומאומת ✓"** — only means access_token +
  phone_number_id were validated against Graph API at save time. Says
  nothing about webhook delivery.
- **App Dashboard "Webhook Test" succeeds** — synthetic, bypasses the WABA
  subscription (step 4). Does not prove real messages will arrive.
- **WhatsApp Manager "Messages received" insights = 0** — the date range
  defaults to a historical window that may **exclude today**. Check the
  date picker before treating this as evidence of failure.
