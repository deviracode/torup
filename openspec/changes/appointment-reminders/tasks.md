# Tasks: Appointment Reminders

## 1. Database Schema

- [x] 1.1 Create migration for `reminder_settings` table (id, business_id, minutes_before, is_active, created_at; unique on business_id+minutes_before)
- [x] 1.2 Add `whatsapp_message_id` column to `notifications_log` table
- [x] 1.3 Add `customer_response` column (enum: null, confirmed, cancelled) to `notifications_log`
- [x] 1.4 Add `responded_at` TIMESTAMPTZ column to `notifications_log`
- [x] 1.5 Add RLS policies for `reminder_settings` (business owner read/write)

## 2. API Endpoints

- [x] 2.1 Create `GET /api/businesses/:businessId/reminder-settings` endpoint (auth required, returns list of reminder intervals)
- [x] 2.2 Create `POST /api/businesses/:businessId/reminder-settings` endpoint (auth required, body: { minutes_before })
- [x] 2.3 Create `DELETE /api/businesses/:businessId/reminder-settings/:id` endpoint (auth required)
- [x] 2.4 Create `PATCH /api/businesses/:businessId/reminder-settings/:id` endpoint (auth required, toggle is_active)
- [x] 2.5 Register reminder-settings routes in Express app

## 3. Refactor Reminder Scheduler

- [x] 3.1 Refactor `processReminders()` to query `reminder_settings` per business instead of hardcoded 24h/2h intervals
- [x] 3.2 Build query that joins `reminder_settings` × `appointments` to find due reminders (where `start_time - minutes_before` falls within [now-5min, now])
- [x] 3.3 Cross-reference `notifications_log` to skip already-sent reminders (existing logic, adapt for dynamic intervals)
- [x] 3.4 Filter to only `pending` and `confirmed` appointment statuses

## 4. WhatsApp Integration

- [x] 4.1 Create `sendWhatsAppMessage()` utility in `apps/api/src/services/whatsapp.ts` that calls Meta Cloud API (with env vars for token, phone number ID)
- [x] 4.2 Create `sendInteractiveReminder()` function that sends a template message with confirm/cancel quick-reply buttons
- [x] 4.3 Update `sendAppointmentNotification()` to call `sendWhatsAppMessage()` instead of console.log (with fallback to console.log when WHATSAPP_TOKEN is not set)
- [x] 4.4 Store the returned WhatsApp message ID in `notifications_log.whatsapp_message_id`

## 5. WhatsApp Webhook for Button Responses

- [x] 5.1 Create `POST /api/webhooks/whatsapp` endpoint with Meta signature verification
- [x] 5.2 Create `GET /api/webhooks/whatsapp` endpoint for Meta webhook verification challenge
- [x] 5.3 Handle `interactive.button_reply` events — parse button payload (confirm/cancel)
- [x] 5.4 Look up appointment from `notifications_log` via `whatsapp_message_id`
- [x] 5.5 Validate status transition is allowed (using existing `validateTransition` from @queue/shared)
- [x] 5.6 Update appointment status and send acknowledgment message
- [x] 5.7 Handle invalid transitions gracefully (send informational message, no status change)

## 6. Dashboard Settings UI

- [x] 6.1 Add "Reminders" tab to settings page (`apps/web/src/app/[locale]/dashboard/settings/page.tsx`)
- [x] 6.2 Fetch and display existing reminder settings on tab load
- [x] 6.3 Add preset selector (dropdown/buttons) for adding new reminder intervals
- [x] 6.4 Add toggle switch for each reminder's `is_active` state
- [x] 6.5 Add delete button for each reminder with confirmation
- [x] 6.6 Add translations for reminder settings labels (he, en, ar) in i18n message files

## 7. Appointment Modal Enhancement

- [x] 7.1 Fetch reminder notification logs for the appointment in `AppointmentModal`
- [x] 7.2 Display reminder status section: sent time, delivery status, customer response
- [x] 7.3 Add translations for reminder status labels (he, en, ar)

## 8. Testing

- [x] 8.1 Unit tests for refactored `processReminders()` with configurable intervals
- [x] 8.2 Unit tests for WhatsApp webhook button response handling
- [x] 8.3 Test duplicate reminder prevention
- [x] 8.4 Test that cancelled/completed appointments don't receive reminders
