## MODIFIED Requirements

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
