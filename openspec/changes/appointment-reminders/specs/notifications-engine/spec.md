## MODIFIED Requirements

### Requirement: Appointment reminder notifications
The system SHALL send WhatsApp reminders to customers before their appointments. Businesses SHALL configure reminder timing via `reminder_settings` (e.g., 24 hours before, 2 hours before). Multiple reminders per appointment SHALL be supported. Reminders SHALL use WhatsApp interactive template messages with confirm/cancel quick-reply buttons. The reminder scheduler SHALL query `reminder_settings` per business instead of using hardcoded intervals.

#### Scenario: 24-hour reminder sent
- **WHEN** an appointment is 24 hours away and the business has a 24-hour reminder configured in `reminder_settings`
- **THEN** a WhatsApp interactive template message is sent to the customer with appointment details and confirm/cancel buttons

#### Scenario: Business without configured reminders
- **WHEN** the reminder scheduler runs for a business with no `reminder_settings` rows
- **THEN** no reminders are sent for that business's appointments
