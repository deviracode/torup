## ADDED Requirements

### Requirement: Business onboarding
The super admin panel SHALL provide a workflow to onboard new businesses: create business record, set initial plan, configure WhatsApp number, and activate the business.

#### Scenario: Super admin onboards a new barber shop
- **WHEN** the super admin fills in business details and clicks "Create Business"
- **THEN** the business is created with the selected plan, credentials are generated for the owner, and a welcome email is sent

### Requirement: Business directory
The super admin panel SHALL display a searchable, filterable list of all businesses on the platform with: name, category, plan, subscription status, creation date, appointment count, and active/inactive status.

#### Scenario: Super admin filters by subscription status
- **WHEN** the super admin filters the business list by "Expired" subscription
- **THEN** only businesses with expired subscriptions are shown

### Requirement: Business detail management
The super admin SHALL be able to view and edit any business's: profile, configuration, services, working hours, staff, and subscription details. All changes SHALL be audit-logged.

#### Scenario: Super admin edits business hours
- **WHEN** a super admin modifies a business's working hours
- **THEN** the changes take effect immediately and an audit log entry is created

### Requirement: Platform analytics dashboard
The super admin panel SHALL display platform-wide metrics: total businesses, total appointments (today/week/month), revenue from subscriptions, new business signups over time, and top businesses by appointment volume.

#### Scenario: Super admin views monthly growth
- **WHEN** the super admin opens the platform analytics
- **THEN** charts show business growth, appointment volume, and subscription revenue trends

### Requirement: Subscription management
The super admin SHALL be able to change a business's plan, extend trial periods, apply discounts, pause subscriptions, and manually mark payments as received.

#### Scenario: Super admin extends a trial
- **WHEN** the super admin extends a business's trial by 14 days
- **THEN** the business's trial end date is updated and they continue to have full access

### Requirement: System configuration
The super admin panel SHALL allow configuring: available subscription plans and pricing, supported business categories, platform-wide notification templates, and WhatsApp message templates.

#### Scenario: Super admin adds a new plan
- **WHEN** the super admin creates a new "Enterprise" plan with custom pricing
- **THEN** the plan becomes available for assignment to businesses

### Requirement: Impersonation
The super admin SHALL be able to impersonate any business owner to view the dashboard as they see it, for troubleshooting purposes. Impersonation sessions SHALL be time-limited and audit-logged.

#### Scenario: Super admin impersonates a business owner
- **WHEN** the super admin clicks "View as" on a business
- **THEN** the dashboard loads with that business's data and a visible banner indicating impersonation mode

### Requirement: Business management table
The admin businesses list SHALL use the Table component with sortable columns, status Badges, and action DropdownMenus.

#### Scenario: Business table display
- **WHEN** the super admin opens the businesses tab
- **THEN** businesses render in a Table with columns for name, owner, plan, status (Badge), created date, and an actions DropdownMenu (edit, delete, impersonate)

### Requirement: Onboarding form redesign
The business onboarding form SHALL use Dialog with shadcn/ui form components (Input, Label, Select, Button).

#### Scenario: Onboarding dialog
- **WHEN** the super admin clicks "Add Business"
- **THEN** a Dialog opens with styled form fields for business name, owner email, plan selection, and a submit Button

### Requirement: Admin analytics cards
The admin analytics page SHALL display platform-wide metrics in Card components.

#### Scenario: Platform stats display
- **WHEN** the super admin views the analytics page
- **THEN** Cards show total businesses, total appointments, revenue, and growth metrics with icons
