## ADDED Requirements

### Requirement: pending_approval appointment status
The `appointment_status` enum SHALL include the value `pending_approval`, representing an appointment that has been requested but not yet accepted or rejected by the business owner.

#### Scenario: Status enum accepts new value
- **WHEN** an appointment row is inserted with `status='pending_approval'`
- **THEN** the insert succeeds and the row is queryable by that status

#### Scenario: Active-status filters include pending_approval
- **WHEN** code computes "active future appointments" for a customer
- **THEN** rows with `status ∈ {pending_approval, pending, confirmed}` and `start_time > now()` are all included

### Requirement: Manager approval rejects overlapping pending applicants
When a manager approves a `pending_approval` appointment, the system SHALL atomically transition every other `pending_approval` appointment whose time range overlaps the approved one to `cancelled`.

#### Scenario: Approving one of several applicants cancels the rest
- **WHEN** appointments A, B, C all hold `status='pending_approval'` for overlapping time ranges at the same business
- **AND** the manager approves A
- **THEN** A becomes `confirmed`
- **AND** B and C become `cancelled` in the same transaction
- **AND** the response identifies the displaced appointment ids so notifications can be dispatched

#### Scenario: Approval ignores non-overlapping pending applicants
- **WHEN** appointment A is approved
- **AND** appointment D is `pending_approval` at a non-overlapping time
- **THEN** D remains `pending_approval`

### Requirement: Manager rejection cancels a single applicant
The system SHALL provide a reject action that transitions one `pending_approval` appointment to `cancelled` without affecting any other applicant.

#### Scenario: Reject leaves siblings alone
- **WHEN** the manager rejects appointment B
- **AND** appointments A and C are also `pending_approval` for the same slot
- **THEN** B becomes `cancelled`
- **AND** A and C remain `pending_approval`
