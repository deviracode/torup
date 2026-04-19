## Context

The platform already has a `notifications.ts` service with hardcoded 24h and 2h reminder intervals, template rendering, and a `processReminders()` function on a 5-minute `setInterval`. However:
- Reminder timing is hardcoded, not configurable per business
- Messages are plain text (logged to console), not sent via WhatsApp
- No interactive buttons for confirm/cancel responses
- No `reminder_settings` table — businesses can't control their reminder preferences
- The existing `notifications_log` table tracks sent notifications but not customer responses

WhatsApp Cloud API supports **interactive messages** with buttons (up to 3 buttons per message), which is ideal for confirm/cancel flows. Template messages require pre-approval from Meta but regular session messages with buttons can be sent within 24h of last customer contact. For reminders (outbound, outside session window), we'll use **template messages** with quick-reply buttons.

## Goals / Non-Goals

**Goals:**
- Business owners can configure reminder timing (multiple intervals, e.g., "24 hours" + "2 hours") via dashboard settings
- Reminders sent via WhatsApp with interactive confirm/cancel buttons
- Customer button responses update appointment status automatically
- Reminder delivery and response tracking in dashboard
- Backward-compatible: businesses without configured reminders get no reminders (opt-in)

**Non-Goals:**
- SMS or email reminders (WhatsApp only for now)
- Custom reminder message text editing by business owners (use system templates)
- Reminder analytics/reporting dashboard (future)
- Recurring appointment reminders (one-off appointments only)

## Decisions

### 1. Configurable reminder intervals via `reminder_settings` table

**Decision:** Create a `reminder_settings` table with one row per reminder interval per business (e.g., business X has rows for 24h and 2h). Each row stores `minutes_before` as an integer.

**Why over alternatives:**
- *Single JSON column on businesses table*: Harder to query ("find businesses with a reminder due in 24h"), requires parsing JSON in queries
- *Separate config table*: Clean relational model, easy to query with `WHERE minutes_before = ?`, simple CRUD

Schema:
```sql
CREATE TABLE reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL CHECK (minutes_before > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, minutes_before)
);
```

### 2. Refactor `processReminders()` to use configured intervals

**Decision:** Replace the hardcoded 24h/2h logic with a query that joins `reminder_settings` with upcoming `appointments` to find which reminders are due. The 5-minute polling interval stays.

The query logic:
1. Get all active `reminder_settings` rows
2. For each, calculate the target window: `appointment.start_time - minutes_before` should be within [now - 5min, now]
3. Cross-reference `notifications_log` to skip already-sent reminders
4. Send via WhatsApp with interactive buttons

### 3. WhatsApp interactive template messages for reminders

**Decision:** Use Meta Cloud API **message templates** with quick-reply buttons for reminders, since reminders are sent outside the 24h session window.

Template structure (needs Meta approval):
- Body: "Reminder: You have an appointment at {business_name} on {date} at {time} for {service_name}"
- Quick Reply Button 1: "Confirm ✓"
- Quick Reply Button 2: "Cancel ✗"

Each button press sends a webhook event with `button.payload` = `"confirm"` or `"cancel"`.

**Why templates over regular messages:** WhatsApp requires template messages for business-initiated conversations outside the 24h window. Reminders are always business-initiated.

### 4. Inbound webhook for button responses

**Decision:** Add a WhatsApp webhook endpoint at `POST /api/webhooks/whatsapp` (or extend the existing one if present) that handles:
- `interactive.button_reply` events
- Parses the button payload to determine confirm/cancel
- Looks up the appointment from `notifications_log` (via `whatsapp_message_id`)
- Updates appointment status accordingly

Add `whatsapp_message_id` column to `notifications_log` to correlate responses with sent messages.

### 5. Dashboard settings UI

**Decision:** Add a "Reminders" section to the existing settings page (new tab alongside hours, breaks, rules, staff, profile). UI allows:
- Toggle reminders on/off
- Add/remove reminder intervals from a preset list (15min, 30min, 1h, 2h, 4h, 12h, 24h, 48h)
- Visual list of active reminders with delete option

### 6. Reminder status in appointment modal

**Decision:** Show a small "Reminders" section in the appointment modal with:
- Which reminders were sent and when
- Customer response (confirmed/cancelled/no response)

Query `notifications_log` for the appointment's reminder entries.

## Risks / Trade-offs

- **[WhatsApp template approval delay]** → Meta takes 1-24h to approve templates. Mitigation: submit templates early; fall back to plain text messages during development (console logging)
- **[5-min polling window edge cases]** → A reminder could be missed if the server restarts during the exact window. Mitigation: the window check uses `appointment.start_time - minutes_before BETWEEN now-5min AND now`, so a restart within 5 minutes still catches it on next tick
- **[Rate limiting]** → WhatsApp has per-business message limits. Mitigation: for MVP, businesses are small (< 50 appointments/day). Add rate limiting later if needed
- **[Button response after status change]** → Customer presses "cancel" but business already marked as "completed". Mitigation: validate transition is allowed before applying; respond with "appointment already completed" message
