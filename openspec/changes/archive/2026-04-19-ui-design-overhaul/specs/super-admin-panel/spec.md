## MODIFIED Requirements

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
