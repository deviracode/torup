## ADDED Requirements

### Requirement: Configurable reminder intervals
Business owners SHALL configure one or more reminder intervals (in minutes before appointment) via the dashboard settings. Each interval SHALL be independently toggleable. Available presets: 15min, 30min, 1h, 2h, 4h, 12h, 24h, 48h.

#### Scenario: Business adds a 24-hour reminder
- **WHEN** a business owner adds a 24-hour (1440 minutes) reminder interval in settings
- **THEN** a `reminder_settings` row is created with `minutes_before=1440` and `is_active=true`

#### Scenario: Business adds multiple reminders
- **WHEN** a business owner configures both 24h and 2h reminders
- **THEN** customers receive two separate reminder messages — one 24h before and one 2h before their appointment

#### Scenario: Business disables a reminder
- **WHEN** a business owner deactivates the 2h reminder
- **THEN** the 2h reminder is no longer sent, but the 24h reminder continues

### Requirement: WhatsApp reminder with interactive buttons
Reminder messages SHALL be sent via WhatsApp as interactive messages with two quick-reply buttons: "Confirm" and "Cancel". The message SHALL include: service name, date, time, and business name in the customer's preferred language.

#### Scenario: Reminder sent with buttons
- **WHEN** a reminder is due (appointment start_time minus minutes_before falls within the current processing window)
- **THEN** a WhatsApp interactive message is sent to the customer with confirm and cancel buttons

#### Scenario: Reminder respects customer language
- **WHEN** a reminder is sent to a customer whose language preference is Arabic
- **THEN** the reminder message and button labels are in Arabic

### Requirement: Customer confirms via WhatsApp button
When a customer taps the "Confirm" button on a reminder message, the system SHALL update the appointment status to `confirmed` and send a confirmation acknowledgment message.

#### Scenario: Customer confirms appointment
- **WHEN** a customer presses the "Confirm" button on a reminder message
- **THEN** the appointment status is updated to `confirmed` and the customer receives "Your appointment is confirmed!"

#### Scenario: Customer confirms already-confirmed appointment
- **WHEN** a customer presses "Confirm" on an appointment that is already `confirmed`
- **THEN** the customer receives "Your appointment is already confirmed" and no status change occurs

### Requirement: Customer cancels via WhatsApp button
When a customer taps the "Cancel" button on a reminder message, the system SHALL update the appointment status to `cancelled`, free the slot, and send a cancellation acknowledgment with a rebooking link.

#### Scenario: Customer cancels appointment
- **WHEN** a customer presses the "Cancel" button on a reminder message
- **THEN** the appointment status is updated to `cancelled` and the customer receives a cancellation confirmation with a link to rebook

#### Scenario: Customer cancels after status already changed
- **WHEN** a customer presses "Cancel" on an appointment that is already `completed` or `in_progress`
- **THEN** the customer receives "This appointment can no longer be cancelled" and no status change occurs

### Requirement: Reminder delivery tracking
The system SHALL log each reminder sent with: appointment ID, WhatsApp message ID, template used, sent timestamp, and delivery/read status. The business dashboard appointment modal SHALL display reminder status.

#### Scenario: Reminder logged on send
- **WHEN** a reminder is sent via WhatsApp
- **THEN** a `notifications_log` entry is created with the WhatsApp message ID and status `sent`

#### Scenario: Delivery status updated
- **WHEN** WhatsApp reports a message as `delivered` or `read`
- **THEN** the corresponding `notifications_log` entry is updated with the new status and timestamp

#### Scenario: Dashboard shows reminder status
- **WHEN** a business owner opens an appointment detail modal
- **THEN** the modal displays which reminders were sent, their delivery status, and the customer's response (if any)

### Requirement: Duplicate reminder prevention
The system SHALL NOT send the same reminder type more than once for the same appointment. If a reminder for a specific interval has already been sent, it SHALL be skipped.

#### Scenario: Duplicate prevention
- **WHEN** the reminder scheduler runs and a 24h reminder was already sent for an appointment
- **THEN** no additional 24h reminder is sent for that appointment

### Requirement: Only remind for eligible appointments
Reminders SHALL only be sent for appointments with status `pending` or `confirmed`. Cancelled, completed, no-show, and in-progress appointments SHALL NOT receive reminders.

#### Scenario: Cancelled appointment skipped
- **WHEN** the reminder scheduler processes an appointment with status `cancelled`
- **THEN** no reminder is sent
