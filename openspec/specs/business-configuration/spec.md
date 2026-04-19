## ADDED Requirements

### Requirement: Service definitions
Each business SHALL define one or more services with: name (in all supported languages), duration (in minutes), price, buffer time between appointments, maximum parallel capacity (e.g., 3 barber chairs), and active/inactive status.

#### Scenario: Business adds a new service
- **WHEN** a business owner creates a service "Men's Haircut" with 30-minute duration, 5-minute buffer, and capacity of 3
- **THEN** the service is available for booking and the scheduling engine accounts for the 3 parallel slots

#### Scenario: Service deactivation
- **WHEN** a business owner deactivates a service
- **THEN** the service no longer appears on the booking page and no new appointments can be created for it, but existing appointments remain unaffected

### Requirement: Working hours configuration
Each business SHALL define weekly working hours with per-day open/close times. Businesses SHALL be able to define different hours for different days and mark specific days as closed.

#### Scenario: Business sets Friday as closed
- **WHEN** a business owner marks Friday as a closed day
- **THEN** no appointment slots are available on Fridays

#### Scenario: Business sets split hours
- **WHEN** a business owner sets Sunday hours as 09:00-13:00 and 16:00-20:00
- **THEN** the scheduling engine only offers slots within those two time ranges

### Requirement: Staff management
Businesses with multiple staff members SHALL be able to add staff, assign them to specific services, and optionally define per-staff working hours that override business-level hours.

#### Scenario: Staff assigned to specific services
- **WHEN** a staff member is assigned to "Men's Haircut" and "Beard Trim" only
- **THEN** the staff member only appears as available for those two services

#### Scenario: Staff with custom hours
- **WHEN** a staff member has custom hours set (e.g., works only Sunday-Wednesday)
- **THEN** the scheduling engine excludes that staff from availability on their off days

### Requirement: Break and holiday management
Businesses SHALL define recurring breaks (e.g., daily lunch break 13:00-14:00) and one-time holidays/closures (specific dates). These SHALL block appointment slots.

#### Scenario: Lunch break blocks slots
- **WHEN** a business has a recurring break from 13:00 to 14:00
- **THEN** no appointment slots overlap with the 13:00-14:00 period

#### Scenario: Holiday closure
- **WHEN** a business adds a holiday on 2026-09-25 (Yom Kippur)
- **THEN** no appointment slots are available for that entire day

### Requirement: Booking rules
Businesses SHALL configure: minimum advance booking time (e.g., 1 hour before), maximum future booking window (e.g., 30 days ahead), and cancellation/reschedule window (e.g., up to 2 hours before).

#### Scenario: Customer tries to book too close to appointment time
- **WHEN** a customer attempts to book an appointment starting in 30 minutes and the business requires 1 hour minimum advance
- **THEN** the system rejects the booking with an appropriate message

#### Scenario: Customer cancels within allowed window
- **WHEN** a customer cancels an appointment 3 hours before the start time and the cancellation window is 2 hours
- **THEN** the appointment is cancelled successfully
