## ADDED Requirements

### Requirement: Pending-approval queue with Approve / Reject actions
The dashboard SHALL surface all `pending_approval` appointments for the active business and provide explicit Approve and Reject actions on each row.

#### Scenario: Pending applicants are visible
- **WHEN** the manager opens the appointments view
- **THEN** appointments with `status='pending_approval'` are listed (visually distinct from `confirmed`) with the customer name, service, and requested time

#### Scenario: Approve action confirms one applicant and rejects overlapping siblings
- **WHEN** the manager clicks Approve on a `pending_approval` row
- **THEN** the dashboard calls the approve endpoint
- **AND** on success the row updates to `confirmed` and any overlapping `pending_approval` siblings disappear from the pending queue (now `cancelled`)

#### Scenario: Reject action cancels a single applicant
- **WHEN** the manager clicks Reject on a `pending_approval` row
- **THEN** the dashboard calls the reject endpoint and the row transitions to `cancelled` while other applicants for the same slot remain pending
