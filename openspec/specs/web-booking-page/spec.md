## ADDED Requirements

### Requirement: Public booking page per business
Each business SHALL have a publicly accessible booking page at `/b/[slug]`. The page SHALL display the business name, logo, description, and list of active services.

#### Scenario: Customer visits booking page
- **WHEN** a customer navigates to `/b/salon-noga`
- **THEN** they see Salon Noga's branding, description, and a list of available services

#### Scenario: Invalid slug
- **WHEN** a customer navigates to `/b/nonexistent-business`
- **THEN** a 404 page is displayed

### Requirement: Service selection and slot picker
The booking page SHALL allow customers to select a service, choose a date from a calendar, and pick from available time slots. The slot picker SHALL update in real-time as dates change.

#### Scenario: Customer selects service and date
- **WHEN** a customer selects "Men's Haircut" and picks next Sunday
- **THEN** available time slots for that service on Sunday are displayed

#### Scenario: No available slots
- **WHEN** a customer picks a fully-booked date
- **THEN** a message indicates no slots available with suggestions for nearby dates

### Requirement: Customer details collection
Before confirming a booking, the page SHALL collect: customer name, phone number (required — used as identifier), and optional notes. Phone number SHALL be validated for Israeli format (+972 or 05x).

#### Scenario: Valid booking submission
- **WHEN** a customer fills in name, valid phone number, and confirms
- **THEN** the appointment is created and a confirmation screen is shown with appointment details

#### Scenario: Invalid phone number
- **WHEN** a customer enters an invalid phone number format
- **THEN** a validation error is shown before submission

### Requirement: Booking confirmation with WhatsApp option
After successful booking, the confirmation page SHALL display appointment details and offer a "Add to WhatsApp" button that deep-links to the business's WhatsApp with a pre-filled message, allowing the customer to receive future notifications.

#### Scenario: Customer opts into WhatsApp
- **WHEN** a customer clicks "Add to WhatsApp" after booking
- **THEN** WhatsApp opens with a pre-filled message to the business number to initiate the notification channel

### Requirement: Server-side rendering for SEO
Booking pages SHALL be server-side rendered with proper meta tags (title, description, Open Graph) so that shared links preview correctly on social media and WhatsApp.

#### Scenario: Booking page link shared on WhatsApp
- **WHEN** a business shares their booking page link in a WhatsApp group
- **THEN** the link preview shows the business name, description, and logo

### Requirement: Mobile-first responsive design
The booking page SHALL be fully responsive with a mobile-first design. All interactive elements (calendar, slot picker, form) SHALL be touch-friendly and usable on mobile devices.

#### Scenario: Customer books on mobile
- **WHEN** a customer accesses the booking page on a mobile phone
- **THEN** the layout adapts to the screen size with large touch targets and readable text

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
