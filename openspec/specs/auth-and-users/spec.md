## ADDED Requirements

### Requirement: Business owner authentication
Business owners and staff SHALL authenticate via email and password through Supabase Auth. The system SHALL support password reset via email.

#### Scenario: Business owner logs in
- **WHEN** a business owner enters valid email and password
- **THEN** the system authenticates them and redirects to their business dashboard

#### Scenario: Password reset
- **WHEN** a business owner requests a password reset
- **THEN** a reset link is sent to their registered email

### Requirement: Customer identification by phone
Customers SHALL be identified by their phone number. When a customer interacts via WhatsApp or the web booking page, the system SHALL look up or create a customer record based on their phone number.

#### Scenario: Returning customer books via WhatsApp
- **WHEN** a known phone number sends a booking request via WhatsApp
- **THEN** the system associates the appointment with the existing customer record

#### Scenario: New customer books via web
- **WHEN** a new phone number is provided during web booking
- **THEN** a new customer record is created and linked to the appointment

### Requirement: Role-based access control
The system SHALL enforce three role levels: `super_admin` (platform-wide access), `business_owner` (full access to own business), and `staff` (limited access to own business — view/manage appointments only). Each business member SHALL have exactly one role per business.

#### Scenario: Staff member attempts to change business settings
- **WHEN** a staff member tries to access business configuration pages
- **THEN** the system denies access and shows an unauthorized message

#### Scenario: Super admin accesses any business
- **WHEN** a super admin navigates to any business's dashboard
- **THEN** the system grants full read/write access to that business's data

### Requirement: Session management
Authenticated sessions SHALL use JWT tokens with a configurable expiration. The system SHALL support token refresh without requiring re-login.

#### Scenario: Token expires during active session
- **WHEN** an access token expires while the user is actively using the dashboard
- **THEN** the system automatically refreshes the token without interrupting the user
