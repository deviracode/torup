# Appointment System Improvements — Design Spec

**Date:** 2026-05-30
**Status:** Approved

## Summary

Eight improvements to the Torup appointment management platform:

| # | Item | Type |
|---|------|------|
| 1 | Allow multiple bookings — configurable per business | Enhancement |
| 2 | Services without price ("discuss with manager") | Feature |
| 3 | Manager booking from calendar page | Feature |
| 4 | WhatsApp: schedule by specific date (DD/MM/YYYY) | Enhancement |
| 5 | WhatsApp notification to primary manager on new appointments | Feature |
| 6 | No reminders for unapproved appointments | Already working — skipped |
| 7 | WhatsApp: time-of-day grouping for available slots | Enhancement |
| 8 | Google Calendar two-way sync | Feature |

---

## Item 1: Multiple Bookings Per Business

### DB Migration

```sql
ALTER TABLE businesses
  ADD COLUMN allow_multiple_bookings BOOLEAN NOT NULL DEFAULT false;
```

### Changes

**WhatsApp agent** (`services/whatsapp-agent/src/index.ts` — `createBooking`):
- Fetch `allow_multiple_bookings` from the business row
- When `true`, skip the single-active-appointment check (lines 322–334)
- When `false`, keep current behavior

**Web API** (`apps/api/src/routes/appointments.ts` — POST):
- No change needed. The API does not enforce a single-appointment cap; it only enforces slot capacity.

**Settings UI** (`apps/web/src/app/[locale]/dashboard/settings/page.tsx`):
- Add toggle: "Allow customers to book multiple appointments"
- PATCH to `/api/businesses/:id` with `allow_multiple_bookings`

---

## Item 2: Services Without Price

### DB Migration

```sql
ALTER TABLE services
  ADD COLUMN price_type TEXT NOT NULL DEFAULT 'fixed'
  CHECK (price_type IN ('fixed', 'discuss'));
```

When `price_type = 'discuss'`, the `price` column is ignored in display.

### Changes

**WhatsApp agent** (`services/whatsapp-agent/src/index.ts`):
- In `getBusinessServices`, include `price_type`
- When a service with `price_type = 'discuss'` is selected, show a message:
  > "שירות זה דורש תיאום עם בעל העסק. צרו קשר בוואטסאפ: [link]"
- Send a WhatsApp link button instead of proceeding to date selection
- No appointment is created

**Web booking flow** (`apps/web/src/components/booking/booking-flow.tsx`):
- Show "לשיחה עם בעל העסק" instead of `₪X` for discuss-type services
- On click, redirect to WhatsApp (same as current confirmation step WhatsApp link, but without creating an appointment)

**API** (`apps/api/src/routes/services.ts`):
- Accept `price_type` in POST and PATCH

---

## Item 3: Manager Booking From Calendar

### Overview

Rewrite the existing `NewAppointmentForm` component. The manager fills in: service, date, time, customer (existing or new), notes, and status.

### Form Design (Single Page)

All fields on one scrollable modal form:

1. **Service** — dropdown of active services, showing duration + price (or "לשיחה")
2. **Date** — native date input, constrained to `max_future_days`
3. **Time** — grid of available slots, fetched after service+date selected. No cap on slots shown
4. **Customer** — search existing by name/phone, or create new inline (name + phone)
5. **Notes** — optional textarea
6. **Status** — dropdown: `confirmed` (instant book) or `pending_approval` (needs customer confirmation)

### Key Behaviors

- Manager can override slot capacity — show a warning if over capacity but allow booking
- On submit: `POST /api/businesses/:id/appointments` with `created_via: "manual"` and chosen status
- Send WhatsApp notification to customer when status is `confirmed`
- On success: close modal, refresh calendar
- Form validates: service selected, date+time selected, customer identified (either selected or new with name+phone)

### Files

- **`new-appointment-form.tsx`** — rewritten component
- **API** — no structural changes needed (POST already handles the request shape)

---

## Item 4: WhatsApp Date Input

### Flow Change

After selecting a service, the customer chooses:

- "📅 התאריכים הקרובים" — shows 5 next available dates (current flow, expanded from 3)
- "📆 תאריך אחר" — prompts to type a date

### Specific Date Path

1. Prompt: "הקלידו תאריך בפורמט DD/MM/YYYY"
2. Parse and validate:
   - Must be a valid date
   - Not in the past
   - Within `max_future_days` window
   - Business is open that day
   - At least one time slot available
3. If invalid, explain why and let retry
4. If valid, show time slots (grouped — see Item 7)

### Session State

Add `bookingFlow` field: `"quick"` | `"specific"`. This replaces the implicit flow assumption and allows back-navigation.

---

## Item 7: Time-of-Day Grouping

### Grouping Rules

- **Morning** (06:00–11:59): ☀️ בוקר
- **Noon** (12:00–15:59): 🌤️ צהריים
- **Afternoon/Evening** (16:00+): 🌙 אחה"צ/ערב

Empty sections are hidden. Within each section, all available slots are shown (remove the 10-slot cap from `getAvailableTimeSlots`).

### WhatsApp Implementation

Since WhatsApp list messages have a 10-row limit per section, use up to 3 sections (one per time-of-day group). If a section has more than 10 slots, prioritize the earliest 10.

### Code Changes

- **`getAvailableTimeSlots`** in `index.ts`: remove `&& slots.length < 10` from the loop condition
- **`sendTimeSlots`**: group slots by time-of-day, build multi-section list message, skip empty groups

---

## Item 5: Manager Notifications

### What Gets Sent

WhatsApp message to the business owner when a new appointment is created:

```
🔔 תור חדש!
👤 [customer name]
✂️ [service name]
📅 [date] ⏰ [time]
📱 [customer phone]

סטטוס: ממתין לאישור
```

### Delivery

**WhatsApp** — sent to the business owner's phone (from `business_members` where `role = 'owner'`). If no owner WhatsApp is available, fall back to the business phone.

**In-app** — a notification badge in the dashboard showing pending approvals count. Polled from existing `GET /api/businesses/:id/appointments?status=pending_approval`.

### Implementation

**API** — new function `sendManagerNotification(appointmentId)` in `notifications.ts`. Called as fire-and-forget after:
- `POST /api/businesses/:id/appointments` (web/manual bookings)
- WhatsApp agent's `createBooking` (via internal API call or shared function)

**DB** — log manager notifications in `notifications_log` with `type = 'manager_new_booking'`. No new tables needed.

**Web dashboard** — add badge on "Pending" stat card showing count of `pending_approval`. Poll every 60 seconds.

---

## Item 8: Google Calendar Two-Way Sync

### DB Migrations

```sql
CREATE TABLE google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  google_calendar_id TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE google_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  summary TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  UNIQUE(business_id, google_event_id)
);

CREATE INDEX idx_gcal_events_business_time
  ON google_calendar_events(business_id, start_time, end_time);

ALTER TABLE appointments
  ADD COLUMN google_event_id TEXT;
```

### Inbound Sync (Google → System)

1. Cron endpoint `POST /api/internal/google-calendar/sync` runs every 15 minutes
2. For each business with `sync_enabled = true` and valid tokens:
   - Fetch events from connected Google Calendar for the next 60 days
   - Upsert into `google_calendar_events` (match on `google_event_id`)
   - Delete cached events no longer in Google (handle cancellations)
3. Availability engine includes `google_calendar_events` as conflicts — they block slots just like existing appointments

### Outbound Sync (System → Google)

1. On appointment create/update/delete, if `push_enabled = true` and tokens valid:
   - **Create**: Insert event into Google Calendar, store returned `google_event_id` on appointment
   - **Update**: Update event in Google Calendar using stored `google_event_id`
   - **Delete/Cancel**: Delete event from Google Calendar
2. Operations are fire-and-forget — failures logged but don't block the appointment

### OAuth Flow

1. Business owner clicks "Connect Google Calendar" in Settings
2. Redirect to Google OAuth consent screen (scope: `calendar.events`, `calendar.readonly`)
3. Google redirects back to callback URL
4. Exchange code for tokens, encrypt and store in `google_calendar_tokens`
5. Fetch user's calendar list, let them pick which calendar to sync

### Settings UI

- "Connect Google Calendar" button (or "Disconnect" if connected)
- Toggle: "Sync availability from Google Calendar"
- Calendar selector (dropdown of user's calendars)
- Toggle: "Push new appointments to Google Calendar"
- Sync status indicator (last synced, any errors)

### Dependencies

- `googleapis` npm package (Google Calendar API v3)

### API Endpoints

- `POST /api/businesses/:id/google-calendar/connect` — exchange OAuth code
- `DELETE /api/businesses/:id/google-calendar/connect` — disconnect
- `GET /api/businesses/:id/google-calendar/status` — sync status
- `POST /api/internal/google-calendar/sync` — cron endpoint

### Updated Availability Check

In `apps/api/src/routes/availability.ts` and `services/whatsapp-agent/src/index.ts` (`getAvailableTimeSlots`), add a query to `google_calendar_events` for the target date and include those events in the conflict detection.

---

## Error Handling

- **WhatsApp date parsing**: Invalid dates get a descriptive error message (past date, outside booking window, business closed, no availability). User can retry.
- **Google Calendar**: Token refresh failures disable sync and log. Network errors to Google API are retried once, then logged and skipped.
- **Manager notifications**: WhatsApp send failures are logged but don't affect the booking flow.

## Testing

| Item | What to test |
|------|-------------|
| 1 | Toggle on → customer can book multiple; toggle off → rejected with existing message |
| 2 | Discuss-type service → WhatsApp link shown, no appointment created |
| 3 | Manager creates appointment with existing customer, new customer, confirmed status, pending_approval status |
| 4 | Valid date → shows slots; invalid/past/out-of-range dates → error message |
| 7 | Time slots grouped correctly, empty groups hidden, all slots shown (not capped) |
| 5 | Manager receives WhatsApp + dashboard badge on new booking |
| 8 | OAuth flow, events imported block availability, appointment push creates Google event |
