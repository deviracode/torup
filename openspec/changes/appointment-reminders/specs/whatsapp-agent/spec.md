## ADDED Requirements

### Requirement: Interactive button response handling
The WhatsApp webhook SHALL handle incoming `interactive.button_reply` events from reminder messages. The system SHALL parse the button payload (`confirm` or `cancel`), look up the associated appointment via the WhatsApp message ID stored in `notifications_log`, and update the appointment status accordingly.

#### Scenario: Confirm button pressed
- **WHEN** the webhook receives a button reply with payload `confirm` for a reminder message
- **THEN** the system updates the appointment status to `confirmed` and sends an acknowledgment message

#### Scenario: Cancel button pressed
- **WHEN** the webhook receives a button reply with payload `cancel` for a reminder message
- **THEN** the system updates the appointment status to `cancelled`, frees the time slot, and sends a cancellation acknowledgment with a rebooking link

#### Scenario: Invalid transition from button response
- **WHEN** the webhook receives a button reply for an appointment whose current status doesn't allow the requested transition
- **THEN** the system sends an informational message to the customer explaining the appointment cannot be modified and does not change the status
