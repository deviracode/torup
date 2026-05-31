## ADDED Requirements

### Requirement: Approval notification on manager confirm
The notifications engine SHALL send a WhatsApp message to a customer when their `pending_approval` appointment is approved by the manager.

#### Scenario: Approval message is dispatched
- **WHEN** an appointment transitions from `pending_approval` to `confirmed` via the approve endpoint
- **THEN** a `approval` template message is sent to the customer in their preferred language with `business_name`, `service_name`, `date`, and `time`
- **AND** the dispatch is recorded in `notifications_log` with `status='sent'` (or `failed` with an error message if the WhatsApp send fails)

### Requirement: Slot-taken rejection notification for displaced applicants
When manager approval cancels other `pending_approval` applicants for the same slot, the engine SHALL send each displaced customer a `rejection_slot_taken` message that explains another customer was chosen and offers a link to book a different time.

#### Scenario: Displaced applicants are notified
- **WHEN** the approve endpoint cancels appointments B and C as side effects of approving A
- **THEN** a `rejection_slot_taken` message is sent to both B's and C's customers
- **AND** the message includes a `rebook_url` pointing to the public booking page for that business

### Requirement: Manager-initiated rejection notification
The engine SHALL send a softer rejection message when a manager explicitly rejects a single applicant via the reject endpoint (no "another customer was chosen" framing).

#### Scenario: Single rejection message
- **WHEN** the manager rejects appointment B via the reject endpoint
- **THEN** B's customer receives a `rejection_manual` message inviting them to book a different time, with no mention of another customer
