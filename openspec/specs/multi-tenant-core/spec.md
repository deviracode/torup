## ADDED Requirements

### Requirement: Tenant isolation via business_id
Every tenant-scoped database table SHALL include a `business_id` column. Row-Level Security (RLS) policies SHALL enforce that authenticated users can only access data belonging to their associated business.

#### Scenario: Business owner queries appointments
- **WHEN** a business owner queries the appointments table
- **THEN** only appointments belonging to their business are returned

#### Scenario: Cross-tenant data access prevented
- **WHEN** a user attempts to query data with a `business_id` that does not match their authenticated business
- **THEN** the query returns zero results and no error is exposed

### Requirement: Business registration
The system SHALL allow new businesses to register by providing: business name, owner name, phone number, email, and business type (category). Upon registration, the system SHALL create a new tenant workspace with a unique slug.

#### Scenario: New business registers successfully
- **WHEN** a new business owner completes the registration form with valid details
- **THEN** a new business record is created with a unique `business_id` and URL slug

#### Scenario: Duplicate slug handling
- **WHEN** a business registers with a name that generates a slug already in use
- **THEN** the system SHALL append a numeric suffix to create a unique slug

### Requirement: Business profile management
Each business SHALL have a profile containing: name, slug, description, logo, cover image, business type/category, phone number, address, and social media links.

#### Scenario: Business updates their profile
- **WHEN** a business owner updates their profile information
- **THEN** the changes are persisted and reflected on their public booking page

### Requirement: Soft delete for businesses
The system SHALL support soft deletion of businesses. A soft-deleted business SHALL not appear in public listings or accept new bookings but its data SHALL be retained for the configured retention period.

#### Scenario: Business is deactivated
- **WHEN** a super admin deactivates a business
- **THEN** the business booking page returns a "Business unavailable" message and no new appointments can be created
