## ADDED Requirements

### Requirement: Customer name capture and reuse
The bot SHALL identify the inbound customer by phone number on every message and treat the conversation as one of three cases: known-with-name, known-without-name, or new.

#### Scenario: Returning customer is greeted by name
- **WHEN** an inbound WhatsApp message arrives from a phone that exists in `customers` with a non-empty `name`
- **THEN** the bot's first reply addresses the customer by that name and the bot does not ask for the name again

#### Scenario: New customer is asked for name before booking
- **WHEN** an inbound message arrives from a phone with no matching `customers` row
- **THEN** the bot asks for the customer's name as the first conversational step
- **AND** on receiving a name, the bot inserts a `customers` row (or updates the existing row by phone) with the captured name and the detected language preference before continuing

#### Scenario: Known customer with missing name
- **WHEN** an inbound message arrives from a phone that exists in `customers` but with a null/empty `name`
- **THEN** the bot asks for the name once and updates the existing customer row before continuing

### Requirement: Bot creates appointments as pending approval
The bot SHALL never create auto-confirmed appointments. All bot-initiated bookings are written with `status='pending_approval'`.

#### Scenario: Booking confirmation message wording
- **WHEN** the bot successfully inserts a new appointment
- **THEN** the bot replies that the appointment is awaiting the business owner's approval (in the customer's language) and does NOT say the appointment is confirmed

#### Scenario: Multiple customers may apply for the same slot
- **WHEN** two different customers each request the same time slot from the bot
- **AND** neither has been approved yet by the manager
- **THEN** both insertions succeed with `status='pending_approval'`

### Requirement: Single active appointment cap per customer per business
The bot SHALL reject a new booking when the requesting customer already has an active future appointment at the same business.

#### Scenario: Cap blocks duplicate booking
- **WHEN** a customer asks the bot for a new appointment at business B
- **AND** that customer already has at least one appointment at business B with `status ∈ {pending_approval, pending, confirmed}` and `start_time > now()`
- **THEN** the bot does not insert a new appointment
- **AND** the bot replies explaining that the customer already has an active booking and offers to show or cancel it
