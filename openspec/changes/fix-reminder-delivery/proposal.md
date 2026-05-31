## Why

Configured WhatsApp reminders never reach customers. A user with `minutes_before=60` set in `reminder_settings` did not receive a reminder for an upcoming appointment. Investigation found two compounding bugs that defeat the feature in production: (1) the message-template lookup is keyed by a string the templates map will never contain (`reminder_60m` vs the only registered keys `reminder_24h` / `reminder_2h`), so even when the cron fires it sends an empty body — which Meta rejects but is then logged as `sent`, blocking any retry; and (2) the cron itself is an in-process `setInterval` inside the API server, which on Cloud Run dies whenever the service scales to zero between requests — so for low-traffic businesses the cron rarely runs at all.

## What Changes

- Generate the reminder message template dynamically from `minutes_before` (e.g., "in 60 minutes", "tomorrow at HH:MM") instead of looking up a static map keyed by an exact-minutes string. Keep per-language phrasing (he / ar / en).
- Replace silent failures with truthful logging: when the WhatsApp API returns no message ID or throws, write `status: 'failed'` (with the error) to `notifications_log`. The dedupe check then permits a retry on the next tick.
- Move reminder dispatch off the in-process `setInterval`. Add a new internal HTTP endpoint `POST /api/internal/reminders/tick` that runs `processReminders()` once and returns counts. Configure GCP Cloud Scheduler to hit that endpoint every 5 minutes with a shared-secret header. Stop calling `startReminderScheduler()` from `index.ts` in production.
- Backfill / repair existing rows: a one-time SQL migration deletes `notifications_log` rows for `template_id LIKE 'reminder_%m'` with `status='sent'` and a `NULL` `whatsapp_message_id` (the silent-failure rows), so historical undelivered reminders can re-fire on the next cron tick if still in window.
- Add an integration test that asserts `processReminders` produces a non-empty rendered body for every supported `minutes_before` value, and that a failed send writes `status='failed'`.

## Capabilities

### New Capabilities
*(none — all changes extend existing capabilities)*

### Modified Capabilities
- `notifications-engine`: requirements change — reminder template must be generated from interval (not looked up by exact-minutes key); failed WhatsApp sends must be logged as `failed` (not `sent`); reminder dispatch must be triggered by an external scheduler hitting an internal HTTP endpoint, not by an in-process interval.

## Impact

- **Code:**
  - `apps/api/src/services/notifications.ts` — replace static `templates` reminder entries + `renderTemplate` reminder branch with a dynamic builder; correct the failure-status path; remove `startReminderScheduler` from production startup path (keep export for tests / local dev).
  - `apps/api/src/index.ts` — stop unconditionally calling `startReminderScheduler()` on listen; gate behind `ENABLE_INPROCESS_REMINDER_SCHEDULER=true` for local dev.
  - `apps/api/src/routes/internal.ts` *(new)* — `POST /api/internal/reminders/tick` protected by `X-Internal-Secret` header.
  - `apps/api/src/__tests__/reminders.test.ts` — add cases for dynamic template render and failure logging.
- **Infra:**
  - `cloudbuild-api.yaml` / Cloud Run deploy step — set `INTERNAL_SECRET` env var.
  - GCP Cloud Scheduler — new job `queue-reminders-tick` calling the internal endpoint every 5 minutes (me-west1, queue-manager-1 project).
- **Database:**
  - One-time cleanup statement (run manually via Supabase SQL editor) — does not require a migration file since it only repairs runtime data.
- **No breaking API changes** for the dashboard or WhatsApp agent. Internal endpoint is new and locked down by shared secret.
