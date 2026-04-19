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

### Requirement: Sidebar with Lucide icons and mobile drawer
The dashboard sidebar SHALL use Lucide SVG icons for all navigation items. On mobile viewports, the sidebar SHALL collapse into a Sheet (slide-out drawer) triggered by a hamburger menu button.

#### Scenario: Desktop sidebar
- **WHEN** the dashboard loads on a desktop viewport
- **THEN** the sidebar displays with Lucide icons, active state highlighting, and the business logo/name area

#### Scenario: Mobile sidebar
- **WHEN** the dashboard loads on a mobile viewport (< 768px)
- **THEN** the sidebar is hidden and a hamburger button appears in a top bar; tapping it opens a Sheet overlay with the full navigation

### Requirement: Dashboard overview with stat cards
The dashboard home page SHALL display summary stat Cards (today's appointments, pending, completed, revenue) above the calendar view.

#### Scenario: Stat cards display
- **WHEN** the business owner opens the dashboard
- **THEN** 4 stat Cards show today's appointment count, pending count, completed count, and estimated revenue with icons

### Requirement: Polished calendar views
The daily and weekly calendar views SHALL use Card components for appointment blocks, Badge components for status indicators, and consistent color coding.

#### Scenario: Appointment block styling
- **WHEN** an appointment appears on the calendar
- **THEN** it renders as a Card with the customer name, service, time, and a Badge showing the status (confirmed/pending/completed/cancelled)

### Requirement: Appointment modal redesign
The appointment detail modal SHALL use the Dialog component with clear sections for customer info, service details, time, status actions, and notes.

#### Scenario: Modal opens with full details
- **WHEN** the business owner clicks an appointment on the calendar
- **THEN** a Dialog opens showing customer name, phone, service, time, status Badge, and action buttons (confirm, complete, cancel, no-show)

### Requirement: Forms and settings redesign
All dashboard forms (services, working hours, breaks, staff, booking rules) SHALL use shadcn/ui Input, Select, Label, and Button components with consistent layout.

#### Scenario: Service form styling
- **WHEN** the business owner opens the add/edit service form
- **THEN** the form uses Label + Input pairs, a Select for category, and styled Button components for save/cancel

### Requirement: Analytics page with styled charts
The analytics page SHALL display metrics in Card components with clear typography and layout.

#### Scenario: Analytics cards
- **WHEN** the business owner views the analytics page
- **THEN** metrics (total appointments, revenue, no-show rate, popular services) render in Cards with icons and clear number formatting
