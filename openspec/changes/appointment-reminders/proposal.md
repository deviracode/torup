## Why

Customers frequently miss appointments because they forget or their plans change. Business owners need an automated way to remind customers and let them confirm or cancel ahead of time — reducing no-shows and freeing up slots for other customers. The notifications-engine spec already defines this capability but it hasn't been implemented yet.

## What Changes

- Add a **reminder settings** section to the business configuration (dashboard settings page) where owners can configure:
  - Enable/disable reminders
  - Reminder timing (e.g., 24 hours before, 2 hours before)
  - Support for multiple reminder intervals per business
- Implement a **reminder scheduler** (cron job or scheduled task) that scans upcoming appointments and sends WhatsApp reminders at the configured times
- Send reminders via **WhatsApp interactive messages** with confirm/cancel buttons
- Handle customer responses (confirm → update status to `confirmed`, cancel → update status to `cancelled` and free the slot)
- Add a `reminder_logs` table to track which reminders were sent and customer responses
- Display reminder status in the appointment modal on the dashboard

## Capabilities

### New Capabilities
- `appointment-reminders`: Configurable WhatsApp reminder system with interactive confirm/cancel responses, reminder scheduling, and delivery tracking

### Modified Capabilities
- `notifications-engine`: Adding implementation of the already-spec'd reminder notification requirement
- `business-configuration`: Adding reminder settings (timing, enable/disable) to business settings
- `whatsapp-agent`: Adding inbound handling for interactive button responses (confirm/cancel)

## Impact

- **Database**: New `reminder_settings` and `reminder_logs` tables; new columns or relations on appointments
- **API (Express)**: New endpoints for reminder settings CRUD; webhook handler for WhatsApp interactive button responses
- **Dashboard UI**: New settings tab/section for reminder configuration; reminder status badge in appointment modal
- **WhatsApp**: Outbound interactive template messages; inbound button response handling
- **Infrastructure**: Cron job or scheduled worker process for scanning and sending reminders
- **Dependencies**: Meta Cloud API for WhatsApp interactive messages (template messages require pre-approval)
