## MODIFIED Requirements

### Requirement: Multi-step booking flow with visual step indicator
The booking page SHALL display a step indicator showing progress through: Service Selection → Date → Time → Details → Confirmation. Each step SHALL use Card components for content grouping.

#### Scenario: Step indicator shows current progress
- **WHEN** the customer is on the date selection step
- **THEN** the step indicator highlights steps 1 (completed) and 2 (current), with steps 3-5 shown as upcoming

### Requirement: Service selection as card grid
Services SHALL be presented as a grid of Card components displaying service name, duration, price, and a brief description. The selected card SHALL have a highlighted border.

#### Scenario: Service card selection
- **WHEN** the customer taps a service card
- **THEN** the card shows a selected state (highlighted border + check icon) and the flow advances to date selection

### Requirement: Time slot selection grid
Available time slots SHALL be displayed as a grid of selectable pill/badge components rather than a plain list.

#### Scenario: Time slot display
- **WHEN** available slots load for a selected date
- **THEN** slots render as a responsive grid of tappable badges showing the time (e.g., "10:00", "10:30")

### Requirement: Confirmation step with summary card
The confirmation step SHALL display a summary Card with all booking details (service, date, time, customer info) and a prominent confirm button.

#### Scenario: Booking summary display
- **WHEN** the customer reaches the confirmation step
- **THEN** a Card displays service name, date, time, customer name, phone, and price with a "Confirm Booking" Button
