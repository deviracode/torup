## ADDED Requirements

### Requirement: Appointment calendar view
The dashboard SHALL display appointments in daily and weekly calendar views. Each appointment SHALL show customer name, service, time, duration, and status with color coding.

#### Scenario: Business owner views daily calendar
- **WHEN** a business owner opens the dashboard
- **THEN** today's appointments are displayed in a timeline view with color-coded status indicators

#### Scenario: Weekly view with multiple staff
- **WHEN** a business with 3 staff members switches to weekly view
- **THEN** the calendar shows a column per staff member with their respective appointments

### Requirement: Manual appointment creation
Business owners and staff SHALL be able to manually create appointments from the dashboard by selecting a service, customer (search by name/phone or create new), date, and time slot.

#### Scenario: Walk-in customer booked manually
- **WHEN** a staff member creates an appointment for a walk-in customer
- **THEN** the appointment appears immediately on the calendar and the slot is blocked from online booking

### Requirement: Appointment management actions
The dashboard SHALL allow business owners and staff to: confirm pending appointments, mark as in-progress, mark as completed, mark as no-show, cancel with optional reason, and reschedule by dragging on calendar.

#### Scenario: Mark appointment as no-show
- **WHEN** a business owner marks an appointment as no-show
- **THEN** the appointment status updates, the no-show is recorded on the customer's profile, and the time slot becomes available for new bookings

#### Scenario: Drag to reschedule
- **WHEN** a staff member drags an appointment to a different time slot
- **THEN** the appointment is rescheduled and the customer receives a WhatsApp notification about the change

### Requirement: Customer management
The dashboard SHALL include a customer list with search and filtering. Each customer profile SHALL show: name, phone, appointment history, total visits, no-show count, and notes.

#### Scenario: Business owner searches for customer
- **WHEN** a business owner searches for "Ahmad" in the customer list
- **THEN** all customers matching "Ahmad" are displayed with their details

### Requirement: Dashboard analytics
The dashboard SHALL display key metrics: today's appointments count, this week's revenue, no-show rate, busiest hours, most popular services, and new vs returning customer ratio.

#### Scenario: Business owner views analytics
- **WHEN** a business owner navigates to the analytics section
- **THEN** charts and metrics are displayed for the selected time period (default: last 30 days)

### Requirement: Real-time updates
The dashboard SHALL update in real-time when new appointments are created (via WhatsApp or web booking) or existing appointments change status. No manual refresh SHALL be required.

#### Scenario: New booking while dashboard is open
- **WHEN** a customer books via WhatsApp while the business owner has the dashboard open
- **THEN** the new appointment appears on the calendar within seconds with a subtle notification
