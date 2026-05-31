## Context

The reminder pipeline today has three components living in the API process:

1. `reminder_settings` table — owners pick `minutes_before` per business (`is_active=true`).
2. `processReminders()` in `apps/api/src/services/notifications.ts` — every 5 minutes scans for appointments whose `start_time` falls in `[now + minutes_before − 5min, now + minutes_before + 5min)`, dedupes against `notifications_log`, and dispatches via `sendInteractiveReminder`.
3. An in-process `setInterval` started by `startReminderScheduler()` from `apps/api/src/index.ts:81` on `app.listen`.

Two production failures defeat this:

- **Template miss.** `processReminders` builds `templateId = "reminder_${minutes_before}m"` (e.g. `reminder_60m`). `renderTemplate` then looks up `templates[templateId]?.[lang] || templates[templateId]?.he || ""`. The `templates` map only contains `reminder_24h` and `reminder_2h` — keys that nothing in `processReminders` will ever produce. The body is `""`. Meta rejects empty interactive bodies, but the surrounding code unconditionally writes `status: 'sent'` to `notifications_log`, after which the dedupe permanently suppresses the row.

- **Cold-scaled cron.** Cloud Run scales the API instance to zero between requests. `setInterval` is a JavaScript primitive bound to the live event loop — it dies with the instance and is re-armed only when a fresh request spins a new instance up. For low-traffic businesses (the typical SaaS tenant) the cron rarely runs, and never on a guaranteed cadence.

The two bugs are independent: fixing only the template would still miss most fires; fixing only the cron would deliver empty messages. Both must change.

## Goals / Non-Goals

**Goals:**
- Reminder messages render with non-empty, locale-correct, interval-aware bodies for any `minutes_before` value the owner can configure.
- Failed sends are recorded as `failed` with the error, so the next tick retries.
- Reminder dispatch fires on a guaranteed 5-minute cadence regardless of incoming traffic.
- Local dev keeps a working reminder loop without depending on Cloud Scheduler.
- Existing data with the silent-failure pattern can re-fire (one-time data repair).

**Non-Goals:**
- Per-business custom reminder copy (still a single phrasing per language; only the time-distance varies).
- Multi-channel delivery (SMS / email).
- Sub-minute precision — the 5-minute window stays.
- Replacing the entire notifications-engine — this is targeted at reminders only. Booking confirmations / cancellations stay on their existing inline-trigger paths.
- Building a generic job queue (BullMQ, pg-boss). One scheduled HTTP tick is enough.

## Decisions

### D1 — Dynamic template, not lookup table

Replace the static `reminder_*` entries in the `templates` map with a function `buildReminderBody(minutesBefore, lang, vars)` that produces the body inline. Phrasings:

| minutes_before    | he                                              | ar                                              | en                                          |
| ----------------- | ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| 1..59             | `תזכורת: התור שלך בעוד {n} דקות ⏰ {time}`     | `تذكير: موعدك بعد {n} دقيقة ⏰ {time}`         | `Reminder: appointment in {n} min ⏰ {time}`|
| exactly 60        | `תזכורת: התור שלך בעוד שעה ⏰ {time}`          | `تذكير: موعدك بعد ساعة ⏰ {time}`              | `Reminder: appointment in 1 hour ⏰ {time}` |
| 61..1439 (h+m)    | `תזכורת: התור שלך בעוד {h} שעות ⏰ {time}`     | `تذكير: موعدك بعد {h} ساعات ⏰ {time}`         | `Reminder: appointment in {h}h ⏰ {time}`   |
| exactly 1440      | `תזכורת: יש לך תור מחר בשעה {time}`            | `تذكير: لديك موعد غدا الساعة {time}`           | `Reminder: appointment tomorrow at {time}`  |
| 1441+ (days)      | `תזכורת: יש לך תור בעוד {d} ימים ב-{time}`     | `تذكير: لديك موعد بعد {d} أيام الساعة {time}`  | `Reminder: appointment in {d} days at {time}`|

Service name, business name, and date are appended as a second short line.

**Why over a lookup table:** owners can configure any positive integer `minutes_before`. A lookup table requires us to enumerate every value or fall back silently. A formatter is bounded code that always produces a body.

**Alternative considered:** Keep the lookup, normalize keys (`60` → `1h`, `120` → `2h`, `1440` → `24h`). Rejected — still requires owners to pick from a fixed set, and the bug returns the moment somebody adds `45`.

### D2 — Externalized cron via Cloud Scheduler → internal HTTP endpoint

Add `POST /api/internal/reminders/tick` that runs `processReminders()` once and returns `{ processed, sent, failed }`. Protect it with an `X-Internal-Secret` header equal to `process.env.INTERNAL_SECRET`. Configure GCP Cloud Scheduler in `queue-manager-1` / `me-west1` to call it every 5 minutes.

Stop calling `startReminderScheduler()` from `app.listen` in production. Gate it behind `ENABLE_INPROCESS_REMINDER_SCHEDULER === 'true'` so local dev (`npm run serve`) keeps a working loop without scheduler setup.

**Why over `--min-instances=1`:** keeping an instance hot costs money and still doesn't help if the instance restarts mid-cycle. Cloud Scheduler is the GCP-native correct primitive; one scheduled HTTP call is cheap, observable in the GCP console, and decoupled from request traffic.

**Alternatives considered:**
- *BullMQ / Redis queue.* Overkill — we have one job, not many; introduces a Redis dependency.
- *pg_cron.* Possible (Supabase supports it) but moves the logic into Postgres extensions, which makes it harder to read TypeScript code as the source of truth.
- *Supabase Edge Function on a schedule.* Plausible, but our code lives in the API service; duplicating the dispatch logic in Deno is friction we don't need.

### D3 — Truthful failure logging

`sendAppointmentNotification` currently writes `status: 'sent'` after calling `sendInteractiveReminder`, regardless of return value. Change this so:

- If the WhatsApp call returns `null` or throws → write `{ status: 'failed', error: <message> }`. The dedupe query in `processReminders` filters by `template_id` and `appointment_id`; rows with `status='failed'` will *not* match a new dedupe (we'll change the dedupe to require `status='sent'`).
- If the call succeeds → write `{ status: 'sent', whatsapp_message_id }` as today.

This makes retries automatic on the next 5-minute tick if the appointment is still in window.

### D4 — One-time data repair, not a migration

Existing `notifications_log` rows from the broken period have `template_id LIKE 'reminder_%m'`, `status='sent'`, `whatsapp_message_id IS NULL` — the silent-failure signature. Run a single SQL statement (documented in tasks; executed manually via Supabase SQL editor) to delete those rows. We deliberately don't add a numbered migration file because:

- It's runtime data repair, not schema change.
- It depends on production state and shouldn't replay against fresh dev DBs.

## Risks / Trade-offs

- **[Cloud Scheduler misconfiguration silently stops reminders]** → Mitigation: `/api/internal/reminders/tick` returns counts; add a Cloud Monitoring alert on "no successful invocation in 15 min" against the scheduler job. Also add a `last_tick_at` log line every invocation.
- **[INTERNAL_SECRET leaks via logs / env exposure]** → Mitigation: store in Secret Manager, reference via `--update-secrets=INTERNAL_SECRET=projects/queue-manager-1/secrets/internal-secret:latest`. Endpoint is read-only-ish (it triggers sends, no DB mutation surface beyond what cron already does).
- **[Cron tick overlaps a previous still-running tick]** → Mitigation: `processReminders` is idempotent on `notifications_log` (dedupe by template_id + appointment_id + status='sent'). Worst case is wasted DB queries, not double-sends. Cloud Scheduler default attempt deadline of 30s is far more than needed.
- **[Template formatter produces grammatically wrong Hebrew/Arabic for edge `n`]** → Mitigation: cover the test matrix in D1 with snapshot tests for `n = 1, 30, 60, 90, 120, 1440, 2880`. Accept "good enough" plurals; we don't need perfect dual-form Arabic.
- **[Local dev forgets to set `ENABLE_INPROCESS_REMINDER_SCHEDULER`]** → Mitigation: default `.env.example` for `apps/api` sets it to `true`. README mentions the flag.
- **[Repair query deletes rows from a future legitimate retry that's been queued elsewhere]** → Low risk; the silent-failure rows have `whatsapp_message_id IS NULL`, which a real successful send never produces. Limit the WHERE clause precisely.

## Migration Plan

1. Land code changes (template builder, failure logging, internal route, gated in-process scheduler).
2. Deploy API to Cloud Run with `INTERNAL_SECRET` in env / Secret Manager.
3. Smoke test: `curl -X POST https://queue-api-…/api/internal/reminders/tick -H "X-Internal-Secret: …"` and verify response counts.
4. Create Cloud Scheduler job `queue-reminders-tick` (5-minute cron, target = the URL above, header set).
5. Run repair SQL once in Supabase.
6. Watch one full reminder cycle end-to-end with a test appointment.

**Rollback:** revert API deploy; keep Cloud Scheduler job paused. The in-process loop returns automatically if `ENABLE_INPROCESS_REMINDER_SCHEDULER=true` is set during the rollback. No DB schema changes to undo.
