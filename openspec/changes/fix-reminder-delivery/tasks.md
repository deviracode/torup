## 1. Dynamic reminder template

- [x] 1.1 In `apps/api/src/services/notifications.ts`, add `buildReminderBody(minutesBefore, lang, vars)` that returns a non-empty string for any positive `minutesBefore`. Cover minute (1–59), exactly-1h, hour-range (61–1439), exactly-24h, and day (1441+) buckets per the table in design.md, in he / ar / en.
- [x] 1.2 Remove `reminder_24h` and `reminder_2h` entries from the static `templates` map in the same file.
- [x] 1.3 Branch `renderTemplate` so that when `templateId` matches `/^reminder_(\d+)m$/`, it calls `buildReminderBody(parseInt($1, 10), lang, vars)` instead of consulting the static map.
- [x] 1.4 Verify `processReminders` still produces `reminder_${minutes_before}m` template ids — no change required, just confirm the contract.

## 2. Truthful failure logging

- [x] 2.1 In `sendAppointmentNotification`, capture the WhatsApp send return value and any thrown error. If `whatsappMessageId` is null (or send threw), log `{ status: 'failed', error: <message> }` to `notifications_log`. Otherwise keep current `status: 'sent'` behavior.
- [x] 2.2 In `processReminders`, change the dedupe query from `.eq('appointment_id', apt.id).eq('template_id', templateId)` to additionally `.eq('status', 'sent')` so failed rows do not suppress retries.
- [x] 2.3 Add column `error TEXT` to `logNotification`'s parameter type and the `notifications_log` insert payload (column already exists in schema; just thread it through the type).

## 3. Externalized cron via internal HTTP endpoint

- [x] 3.1 Create `apps/api/src/routes/internal.ts` exporting an Express Router with `POST /reminders/tick`. Validate `req.header('x-internal-secret') === process.env.INTERNAL_SECRET`; reject with 401 if not.
- [x] 3.2 Inside the handler, call `processReminders()` (refactor it to return `{ processed, sent, failed }` counters; default counters to zero in current callers) and `res.json(counts)`.
- [x] 3.3 Mount the router in `apps/api/src/index.ts`: `app.use('/api/internal', internalRouter)` BEFORE the rate limiter `/api/` mount, OR exempt `/api/internal` from the limiter so scheduler invocations aren't throttled.
- [x] 3.4 Replace the unconditional `startReminderScheduler()` call in `app.listen` with `if (process.env.ENABLE_INPROCESS_REMINDER_SCHEDULER === 'true') startReminderScheduler();`.
- [x] 3.5 Update `apps/api/.env.example` to document `ENABLE_INPROCESS_REMINDER_SCHEDULER=true` (for local dev) and `INTERNAL_SECRET=changeme` (for the route guard).

## 4. Tests

- [x] 4.1 Extend `apps/api/src/__tests__/reminders.test.ts` with a parametrized case: for `minutesBefore ∈ [1, 30, 45, 60, 90, 120, 1440, 2880]` and each language, assert `renderTemplate('reminder_${m}m', lang, vars)` returns a string of length > 0 that contains both the time variable and a duration phrase.
- [x] 4.2 Add a test that mocks `sendInteractiveReminder` to return `null`, calls `sendAppointmentNotification`, and asserts the resulting `notifications_log` insert payload has `status: 'failed'` and an error message. *(Implemented in `apps/api/src/__tests__/reminder-dispatch.test.ts` to keep mocks isolated.)*
- [x] 4.3 Add a route test for `POST /api/internal/reminders/tick`: 401 with missing/wrong header, 200 + JSON counts with the right header.
- [x] 4.4 Run `pnpm --filter @queue/api test` and `pnpm turbo type-check` and ensure both pass. *(All 62 tests pass; type-check clean.)*

## 5. Production data repair

- [x] 5.1 Document in `tasks.md` the one-time SQL to run via Supabase SQL editor:

      Verification (count rows that will be deleted):
      ```sql
      select count(*) from notifications_log
       where template_id ~ '^reminder_[0-9]+m$'
         and status = 'sent'
         and whatsapp_message_id is null;
      ```

      Repair (delete the silent-failure rows so they can be re-attempted on the next cron tick):
      ```sql
      delete from notifications_log
       where template_id ~ '^reminder_[0-9]+m$'
         and status = 'sent'
         and whatsapp_message_id is null;
      ```

      Re-verify (should return 0):
      ```sql
      select count(*) from notifications_log
       where template_id ~ '^reminder_[0-9]+m$'
         and status = 'sent'
         and whatsapp_message_id is null;
      ```
- [x] 5.2 After deploying code changes, execute the repair SQL once. Capture row count in commit / PR description. *(Deleted 5 silent-failure rows on 2026-04-19 via service-role client.)*

## 6. Deploy & wire Cloud Scheduler

- [x] 6.1 Build & deploy API to Cloud Run (`queue-manager-1` / `me-west1`) with `INTERNAL_SECRET` set via `--update-secrets=INTERNAL_SECRET=projects/queue-manager-1/secrets/internal-secret:latest` (create the secret first if needed). *(Secret `internal-secret` created — v2 has no trailing newline; revision `queue-api-00005-fdz` deployed with `--update-secrets=INTERNAL_SECRET=internal-secret:2`.)*
- [x] 6.2 Smoke test the live endpoint: `curl -X POST https://queue-api-…/api/internal/reminders/tick -H "X-Internal-Secret: $SECRET"` — expect HTTP 200 with `{ processed, sent, failed }`. *(Confirmed: 200 → `{processed:0, sent:0, failed:0}`; missing/wrong header → 401.)*
- [x] 6.3 Create Cloud Scheduler job `queue-reminders-tick` in `me-west1`: cron `*/5 * * * *`, HTTP target = the URL above, method POST, header `X-Internal-Secret` = the secret value. Use OIDC if you want defense-in-depth, but the shared secret is sufficient. *(Job created in `queue-manager-1` / `me-west1`, time-zone `Asia/Jerusalem`.)*
- [x] 6.4 Confirm scheduler shows successful invocations after one tick. *(Manually triggered job once; Cloud Run log shows `[internal/reminders/tick] processed=0 sent=0 failed=0`, HTTP 200 at 13:37:38 UTC.)*
- [ ] 6.5 Create a Cloud Monitoring alert on the Cloud Scheduler job for "no successful invocation in 15 min". *(Skipped — gcloud alpha monitoring policies requires alpha component unavailable non-interactively. Alert policy JSON prepared at /tmp/reminder-alert-policy.json. Owner to apply via console: Cloud Monitoring → Alerting → Create Policy → import JSON, or install gcloud alpha and run from file. Requires notification channel configured.)*

## 7. Verify end-to-end

- [ ] 7.1 With a test customer and a `minutes_before=60` setting, create an appointment ~62 minutes in the future. Within ~5 min the customer should receive a WhatsApp reminder with confirm/cancel buttons. *(Manual verification required — needs real customer phone. Steps: (1) Add reminder_settings with minutes_before=60 for the test business, (2) Create appointment ~62 min in the future, (3) Wait for next Cloud Scheduler tick (within 5 min), (4) Verify customer receives WhatsApp reminder with confirm/cancel buttons.)*
- [ ] 7.2 Check `notifications_log` has the matching row with `status='sent'` and a non-null `whatsapp_message_id`. *(Manual verification — run `SELECT * FROM notifications_log WHERE appointment_id = '<id>' AND template_id LIKE 'reminder_%' ORDER BY sent_at DESC LIMIT 5;` in Supabase SQL editor after 7.1.)*
- [ ] 7.3 Pressing "Confirm" / "Cancel" still flows through the existing webhook handler — confirm appointment status updates accordingly. *(Manual verification — after 7.1, press Confirm/Cancel in WhatsApp and check that appointment status updates correctly in Supabase.)*
