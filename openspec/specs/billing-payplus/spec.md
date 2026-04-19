## ADDED Requirements

### Requirement: Subscription plan management
The system SHALL support multiple subscription plans, each with: name, monthly price, yearly price (with discount), feature limits (max staff, max appointments/month), and active/inactive status.

#### Scenario: Business selects a plan during onboarding
- **WHEN** a new business is being onboarded and a plan is selected
- **THEN** a subscription record is created with the plan details and billing cycle

### Requirement: PayPlus payment integration
The system SHALL integrate with PayPlus API to process recurring subscription payments. Payment pages SHALL be generated via PayPlus for secure card collection (no card data stored in our system).

#### Scenario: Business subscribes to Professional plan
- **WHEN** a business owner selects the Professional plan and proceeds to payment
- **THEN** a PayPlus payment page is generated for secure card entry and upon successful payment the subscription is activated

#### Scenario: Payment fails
- **WHEN** a recurring payment fails (insufficient funds, expired card)
- **THEN** the system records the failure, notifies the business owner, and retries according to the configured retry policy

### Requirement: Subscription lifecycle management
Subscriptions SHALL support states: `trial`, `active`, `past_due`, `cancelled`, `expired`. The system SHALL enforce feature limits based on the active plan and restrict access when subscription is expired.

#### Scenario: Trial expires without payment
- **WHEN** a business's trial period ends without subscribing to a paid plan
- **THEN** the business dashboard shows a subscription prompt and booking functionality is disabled

#### Scenario: Business upgrades plan
- **WHEN** a business owner upgrades from Starter to Professional mid-cycle
- **THEN** the system prorates the difference and activates the new plan features immediately

### Requirement: Invoice generation
The system SHALL generate invoices for each successful payment with: business details, plan name, billing period, amount, and VAT (if applicable). Invoices SHALL be accessible from the business dashboard.

#### Scenario: Monthly invoice generated
- **WHEN** a successful monthly payment is processed
- **THEN** an invoice is generated and accessible from the business's billing section

### Requirement: Subscription webhooks from PayPlus
The system SHALL handle PayPlus webhook notifications for payment events: successful payment, failed payment, subscription cancelled by customer, and card updated.

#### Scenario: PayPlus sends successful payment webhook
- **WHEN** PayPlus notifies the system of a successful recurring payment
- **THEN** the subscription's `paid_through` date is extended and the payment is recorded
