# WhatsApp bot appointment-time timezone fix — design

## Context

A customer with an appointment at 14:00 Israel time asked the WhatsApp bot
when her appointment was, and the bot replied "11:00" — a UTC/Israel-time
offset (Israel is UTC+2 standard / UTC+3 during DST).

Root cause (confirmed by direct code investigation): `list_appointments`,
the tool Claude calls to look up a customer's appointments
(`services/whatsapp-agent/src/tool-executor.ts:21-45`), returns raw
`start_time`/`end_time` values straight from Postgres —
`JSON.stringify(appointments)` with no formatting at all. The DB stores
these correctly as `TIMESTAMPTZ` (confirmed in
`packages/db/supabase/migrations/00001_initial_schema.sql:151`), so
PostgREST serializes them as UTC ISO strings (e.g.
`2026-08-07T11:00:00+00:00`). Claude has no instruction anywhere (the
system prompt in `agent.ts:49-69` says nothing about timezone handling)
telling it these are UTC, so it reads the hour digits off the raw string
and reports them verbatim as the appointment time.

This is an isolated bug, not a systemic pattern: every other place in the
codebase that formats an appointment time for a customer or manager
(booking confirmations, reminders, manager alerts, the button-webhook
reply path, admin dashboard availability calc) correctly converts with
`timeZone: "Asia/Jerusalem"`. `list_appointments` is the only path where a
raw DB value reaches an LLM without going through a formatting function
first. The write path (booking creation) is also confirmed correct — it
does DST-aware local-to-UTC conversion before storage
(`index.ts:368-378`), so this isn't a double-conversion bug.

## Decisions (confirmed with user)

- Drop `end_time` from what's returned to Claude entirely, rather than
  also formatting it. Nothing in the current system prompt asks Claude to
  mention appointment duration to the customer, and leaving any
  unconverted raw timestamp in the payload risks the same class of bug
  resurfacing if Claude ever references it instead of the formatted
  fields.
- Leave `status` (`"pending"`/`"confirmed"`) as the raw enum value —
  Claude already paraphrases this correctly per the customer's language
  elsewhere in the flow; not part of this bug.

## Fix

In `services/whatsapp-agent/src/tool-executor.ts`, transform each
appointment before returning it, replacing raw `start_time`/`end_time`
with pre-formatted, Israel-local, language-appropriate `date`/`time`
strings and a resolved `service_name` — reusing the exact
locale-selection and timezone pattern already established at
`apps/api/src/services/notifications.ts:211-226`:

```ts
const startDate = new Date(apt.start_time);
const locale = language === "he" ? "he-IL" : language === "ar" ? "ar" : "en";
date: startDate.toLocaleDateString(locale, {
  weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
}),
time: startDate.toLocaleTimeString(locale, {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
}),
```

Service name resolution mirrors the existing pattern at
`notifications.ts:205-209`:
```ts
lang === "ar" && service.name_ar ? service.name_ar :
lang === "en" && service.name_en ? service.name_en :
service.name_he
```

The `executeTool` function already receives `language: "he" | "ar" | "en"`
as a parameter (currently unused inside `list_appointments`) — no new
parameters or call-site changes needed elsewhere.

The transformed shape returned to Claude (as the JSON string) becomes,
per appointment: `{ id, date, time, status, service_name }` — no raw
timestamp fields present at all.

## Out of scope

- Any other tool/formatting path — confirmed during investigation that no
  other site has this bug.
- Localizing `status` values or other minor i18n inconsistencies noted
  during investigation (e.g. some booking-flow messages hardcode `"he-IL"`
  regardless of customer language) — pre-existing, unrelated to this bug.

## Verification

1. New test file `services/whatsapp-agent/src/__tests__/tool-executor.test.ts`
   (no existing test file covers this module), mocking Supabase similarly
   to existing `whatsapp-agent` test patterns. Cases:
   - A UTC `start_time` of `2026-08-07T11:00:00+00:00` (Israel summer/DST,
     UTC+3) produces `time: "14:00"` in the returned JSON.
   - A UTC `start_time` during Israel standard time (UTC+2) produces the
     correctly-offset hour too (DST-boundary sanity check).
   - No `start_time`/`end_time` field is present anywhere in the returned
     JSON string.
   - Service name resolves correctly per `language` (`he`/`ar`/`en`,
     including the `ar`/`en` fallback-to-`name_he` case when those fields
     are null, matching existing fallback behavior elsewhere).
2. `pnpm --filter @torup/whatsapp-agent test` — full suite passes.
3. `pnpm build` — full monorepo build passes.
