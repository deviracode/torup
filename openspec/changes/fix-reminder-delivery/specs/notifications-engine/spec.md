## MODIFIED Requirements

### Requirement: Appointment reminder notifications
The system SHALL send WhatsApp reminders to customers before their appointments. Businesses SHALL configure reminder timing as any positive `minutes_before` value via `reminder_settings`. Multiple reminders per appointment SHALL be supported. The reminder dispatch SHALL be triggered by an external scheduler invoking an internal HTTP endpoint on a fixed cadence (every 5 minutes), independent of incoming application traffic. The reminder message body SHALL be generated dynamically from `minutes_before` so that any configured interval produces a non-empty, locale-correct body.

#### Scenario: 60-minute reminder sent for any configured interval
- **WHEN** an appointment is 60 minutes away and the business has a `minutes_before=60` reminder configured
- **THEN** the customer receives a WhatsApp interactive message whose body says "in 1 hour" (in he / ar / en according to the customer's language preference) with confirm/cancel buttons

#### Scenario: Reminder cron fires on schedule even with zero traffic
- **WHEN** the API service has received no other HTTP requests in the prior hour
- **THEN** the scheduled reminder tick still runs every 5 minutes and dispatches eligible reminders

#### Scenario: Owner picks an unusual interval like 45 minutes
- **WHEN** an owner configures `minutes_before=45`
- **THEN** the reminder for an appointment 45 minutes away is sent with a body that includes "in 45 minutes" (or locale equivalent), not an empty body

### Requirement: Notification templates
All notification messages SHALL use configurable templates with variable substitution (customer name, service, date, time, business name). Templates SHALL exist for each supported language. Reminder bodies SHALL be produced by an interval-aware formatter that handles minute, hour, and day granularities, rather than by a static lookup keyed by exact-minutes strings.

#### Scenario: Hebrew reminder template at 24-hour interval
- **WHEN** a reminder is sent to a Hebrew-speaking customer 24 hours before their appointment
- **THEN** the message body uses the "tomorrow at HH:MM" Hebrew phrasing with the customer's name and appointment details inserted

#### Scenario: Arabic reminder at sub-hour interval
- **WHEN** a reminder is sent to an Arabic-speaking customer 30 minutes before their appointment
- **THEN** the message body uses the "in 30 minutes" Arabic phrasing, not an empty body

### Requirement: Notification delivery tracking
The system SHALL track notification delivery status (sent, delivered, read, failed) and store a log of all sent notifications for audit and debugging purposes. A notification SHALL only be recorded with `status='sent'` if the WhatsApp Cloud API returned a non-null message id. If the API returned no id or threw, the row SHALL be recorded with `status='failed'` and the error message captured. The dedupe check that prevents repeat reminders SHALL only treat rows with `status='sent'` as suppressing future attempts, so failed sends are retried automatically on the next tick if the appointment is still in window.

#### Scenario: Successful interactive reminder
- **WHEN** the WhatsApp API returns a message id for a reminder send
- **THEN** the `notifications_log` row records `status='sent'` and stores the `whatsapp_message_id`

#### Scenario: WhatsApp API failure does not block retry
- **WHEN** the WhatsApp API returns no message id (or throws) for a reminder send
- **THEN** the `notifications_log` row records `status='failed'` with the error, AND the next 5-minute tick re-attempts the same appointment / template combination if still in window

#### Scenario: Successful send is not retried
- **WHEN** a reminder for an appointment / template was previously recorded with `status='sent'`
- **THEN** subsequent ticks SHALL NOT send another reminder for that same appointment / template combination

## ADDED Requirements

### Requirement: Internal scheduled-tick endpoint for reminders
The API service SHALL expose `POST /api/internal/reminders/tick` that runs one cycle of reminder processing and returns counts `{ processed, sent, failed }`. The endpoint SHALL require an `X-Internal-Secret` request header that matches `process.env.INTERNAL_SECRET`; requests with a missing or mismatched secret SHALL receive HTTP 401 with no body. The endpoint SHALL be invoked by an external scheduler (Cloud Scheduler in production) on a 5-minute cadence. The legacy in-process `setInterval` scheduler SHALL only run when `ENABLE_INPROCESS_REMINDER_SCHEDULER=true`, intended for local development.

#### Scenario: Authorized tick processes reminders
- **WHEN** a request arrives at `POST /api/internal/reminders/tick` with the correct `X-Internal-Secret` header
- **THEN** `processReminders()` runs once and the response body contains `{ processed: <n>, sent: <n>, failed: <n> }`

#### Scenario: Unauthorized tick is rejected
- **WHEN** a request arrives at `POST /api/internal/reminders/tick` with a missing or wrong `X-Internal-Secret` header
- **THEN** the response is HTTP 401 with no body and no reminder processing occurs

#### Scenario: Production startup does not arm in-process interval
- **WHEN** the API process starts with `ENABLE_INPROCESS_REMINDER_SCHEDULER` unset or `false`
- **THEN** no `setInterval` is registered for reminder processing, and reminders flow only through the scheduled HTTP endpoint
