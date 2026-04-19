## ADDED Requirements

### Requirement: Availability calculation
The scheduling engine SHALL calculate available time slots for a given service on a given date by considering: working hours, breaks, holidays, existing appointments, service duration, buffer time, and parallel capacity.

#### Scenario: Simple availability with no existing bookings
- **WHEN** availability is requested for a 30-minute service on a day with hours 09:00-17:00 and no existing bookings
- **THEN** the engine returns slots from 09:00 to 16:30 at configurable intervals (default 15 min)

#### Scenario: Availability with partial bookings and parallel capacity
- **WHEN** a service has capacity 3 and there are already 2 bookings at 10:00
- **THEN** the 10:00 slot is still available (1 remaining capacity)

#### Scenario: Availability with full capacity
- **WHEN** a service has capacity 2 and there are already 2 bookings at 10:00
- **THEN** the 10:00 slot is not available

### Requirement: Conflict detection
The scheduling engine SHALL prevent double-booking by checking for conflicts before creating any appointment. A conflict exists when the requested slot would exceed the service's maximum parallel capacity.

#### Scenario: Concurrent booking attempt
- **WHEN** two customers attempt to book the last available slot simultaneously
- **THEN** only one booking succeeds and the other receives a "slot no longer available" response

### Requirement: Buffer time enforcement
The scheduling engine SHALL enforce buffer time between consecutive appointments for the same resource (staff member or capacity unit). Buffer time SHALL not be bookable.

#### Scenario: Buffer time between appointments
- **WHEN** a 30-minute service has a 10-minute buffer and a booking exists at 10:00-10:30
- **THEN** the next available slot for the same resource starts at 10:40, not 10:30

### Requirement: Smart slot suggestions
When a customer requests availability, the scheduling engine SHALL return the nearest available slots to the requested time, including slots on adjacent days if the requested day is fully booked.

#### Scenario: Requested time is fully booked
- **WHEN** a customer asks for availability at 14:00 on Sunday and that slot is full
- **THEN** the engine suggests the closest available slots (e.g., 14:30 Sunday, 13:30 Sunday, 14:00 Monday)

### Requirement: Waitlist support
When all slots for a requested time are booked, the system SHALL offer to add the customer to a waitlist. If a cancellation opens a slot, the first waitlisted customer SHALL be notified.

#### Scenario: Customer joins waitlist
- **WHEN** a customer requests a fully-booked slot and opts for the waitlist
- **THEN** the customer is added to the waitlist for that time slot

#### Scenario: Cancellation triggers waitlist notification
- **WHEN** an appointment is cancelled and there are customers on the waitlist for that slot
- **THEN** the first waitlisted customer receives a WhatsApp notification offering the slot

### Requirement: Appointment lifecycle
Appointments SHALL support the following statuses: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `no_show`. Status transitions SHALL be validated (e.g., a `completed` appointment cannot be cancelled).

#### Scenario: Appointment status progression
- **WHEN** an appointment moves from `confirmed` to `in_progress` to `completed`
- **THEN** each transition is recorded with a timestamp

#### Scenario: Invalid status transition
- **WHEN** a user attempts to cancel a `completed` appointment
- **THEN** the system rejects the transition with an error
