## ADDED Requirements

### Requirement: Webhook message reception
The WhatsApp agent SHALL receive incoming messages via a webhook endpoint. The endpoint SHALL validate the webhook signature from Meta's Cloud API and respond with 200 OK within 5 seconds.

#### Scenario: Valid incoming message
- **WHEN** a customer sends a WhatsApp message to the business number
- **THEN** the webhook receives the message payload and enqueues it for processing

#### Scenario: Invalid webhook signature
- **WHEN** a request arrives with an invalid signature
- **THEN** the endpoint responds with 403 Forbidden and does not process the message

### Requirement: Business routing
The system SHALL route incoming messages to the correct business context. Routing SHALL be based on the WhatsApp number receiving the message or a business identifier in the message flow.

#### Scenario: Message routed to correct business
- **WHEN** a customer messages the WhatsApp number associated with "Salon Noga"
- **THEN** the agent loads Salon Noga's services, hours, and availability for the conversation

### Requirement: Language detection and response
The WhatsApp agent SHALL detect the customer's language from their message and respond in the same language. Supported languages: Hebrew, Arabic, English. The agent SHALL default to Hebrew if detection is uncertain.

#### Scenario: Customer writes in Arabic
- **WHEN** a customer sends "أريد حجز موعد" (I want to book an appointment)
- **THEN** the agent responds in Arabic with available services and booking options

#### Scenario: Language detection uncertain
- **WHEN** a customer sends a short ambiguous message like "Hi"
- **THEN** the agent responds in Hebrew (default) and offers language selection

### Requirement: Booking conversation flow
The WhatsApp agent SHALL guide customers through a multi-turn booking flow: (1) greet and show services, (2) collect service selection, (3) show available dates/times, (4) collect preferred slot, (5) confirm booking details, (6) create appointment upon confirmation.

#### Scenario: Complete booking flow
- **WHEN** a customer initiates a booking conversation
- **THEN** the agent guides them step-by-step through service selection, date/time selection, and confirmation, creating the appointment only after explicit confirmation

#### Scenario: Customer changes mind mid-flow
- **WHEN** a customer selects a service but then asks to see different services
- **THEN** the agent gracefully returns to the service selection step without losing context

### Requirement: Appointment management via WhatsApp
The agent SHALL allow customers to view their upcoming appointments, reschedule (subject to business rules), and cancel (subject to cancellation window).

#### Scenario: Customer asks to see appointments
- **WHEN** a customer sends "מה התורים שלי" (what are my appointments)
- **THEN** the agent lists their upcoming appointments with dates, times, and services

#### Scenario: Customer reschedules
- **WHEN** a customer asks to reschedule an appointment within the allowed reschedule window
- **THEN** the agent shows available alternative slots and updates the appointment upon selection

### Requirement: Structured AI output
The WhatsApp agent SHALL use structured output (tool calls / function calling) from the AI model to execute actions. The agent SHALL NOT create, modify, or cancel appointments based on free-text interpretation alone — all booking actions MUST go through structured action functions.

#### Scenario: AI decides to create booking
- **WHEN** the AI determines the customer wants to book
- **THEN** it emits a structured `create_booking` action with service_id, date, time, and customer_id — which is then validated by the scheduling engine before execution

### Requirement: Conversation state management
The agent SHALL maintain conversation state across multiple messages within a session. A session SHALL timeout after 30 minutes of inactivity, after which a new interaction starts fresh.

#### Scenario: Customer resumes conversation after 10 minutes
- **WHEN** a customer returns to the conversation after 10 minutes of inactivity
- **THEN** the agent remembers where they left off in the booking flow

#### Scenario: Session timeout
- **WHEN** a customer sends a message after 30+ minutes of inactivity
- **THEN** the agent starts a fresh conversation with a greeting
