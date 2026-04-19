## ADDED Requirements

### Requirement: Appointment reminder notifications
The system SHALL send WhatsApp reminders to customers before their appointments. Businesses SHALL configure reminder timing (e.g., 24 hours before, 2 hours before). Multiple reminders per appointment SHALL be supported.

#### Scenario: 24-hour reminder sent
- **WHEN** an appointment is 24 hours away and the business has a 24-hour reminder configured
- **THEN** a WhatsApp message is sent to the customer with appointment details and options to confirm or cancel

### Requirement: Booking confirmation notification
The system SHALL send a WhatsApp confirmation message immediately after an appointment is created, containing: service name, date, time, business name, and business address/location.

#### Scenario: Customer books via web
- **WHEN** a customer completes a booking via the web booking page
- **THEN** a WhatsApp confirmation message is sent to the customer's phone number

### Requirement: Cancellation and reschedule notifications
The system SHALL notify customers via WhatsApp when their appointment is cancelled or rescheduled by the business. The notification SHALL include the reason (if provided) and a link to rebook.

#### Scenario: Business cancels an appointment
- **WHEN** a business owner cancels a customer's appointment
- **THEN** the customer receives a WhatsApp message with the cancellation notice and a booking link

### Requirement: Waitlist notification
When a slot opens up and there are customers on the waitlist, the system SHALL notify the first waitlisted customer with the available slot details and a time-limited option to claim it.

#### Scenario: Slot opens for waitlisted customer
- **WHEN** an appointment is cancelled and a customer is on the waitlist for that slot
- **THEN** the waitlisted customer receives a WhatsApp message offering the slot with a 15-minute claim window

### Requirement: Notification templates
All notification messages SHALL use configurable templates with variable substitution (customer name, service, date, time, business name). Templates SHALL exist for each supported language.

#### Scenario: Hebrew reminder template
- **WHEN** a reminder is sent to a Hebrew-speaking customer
- **THEN** the message uses the Hebrew template with the customer's name and appointment details inserted

### Requirement: Notification delivery tracking
The system SHALL track notification delivery status (sent, delivered, read, failed) and store a log of all sent notifications for audit and debugging purposes.

#### Scenario: Message delivery fails
- **WHEN** a WhatsApp notification fails to deliver (e.g., customer blocked the number)
- **THEN** the failure is logged and visible in the business dashboard's notification log
