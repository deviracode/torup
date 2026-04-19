## ADDED Requirements

### Requirement: Three-language support
The application SHALL support Hebrew (he), Arabic (ar), and English (en) across all user-facing interfaces: booking page, business dashboard, and super admin panel. Hebrew SHALL be the default language.

#### Scenario: User switches language to English
- **WHEN** a user selects English from the language picker
- **THEN** all UI text, labels, buttons, and messages switch to English and the layout direction changes to LTR

### Requirement: RTL layout support
The application SHALL render in right-to-left (RTL) layout for Hebrew and Arabic, and left-to-right (LTR) for English. Layout direction SHALL be set via the `dir` HTML attribute and all CSS SHALL use logical properties (start/end instead of left/right).

#### Scenario: Hebrew dashboard layout
- **WHEN** a business owner views the dashboard in Hebrew
- **THEN** the sidebar is on the right, text is right-aligned, and all directional elements are mirrored

#### Scenario: English booking page layout
- **WHEN** a customer views a booking page in English
- **THEN** the layout follows standard LTR conventions

### Requirement: Per-business default language
Each business SHALL configure a default language for their booking page and notifications. Customers can override the language for their session.

#### Scenario: Arabic-default business
- **WHEN** a customer visits a booking page of a business that defaults to Arabic
- **THEN** the page loads in Arabic with an option to switch to Hebrew or English

### Requirement: Multilingual service names
Service names, descriptions, and category labels SHALL support translations in all three languages. The system SHALL display the service name in the user's selected language, falling back to the business's default language if a translation is missing.

#### Scenario: Service name displayed in customer's language
- **WHEN** a Hebrew-speaking customer views services at an Arabic-default business
- **THEN** service names are shown in Hebrew if translations exist, otherwise in Arabic

### Requirement: Date and time localization
The application SHALL format dates, times, and numbers according to the active language locale. Hebrew and Arabic SHALL support both Gregorian calendar display.

#### Scenario: Hebrew date format
- **WHEN** a date is displayed in Hebrew locale
- **THEN** it follows the DD/MM/YYYY format with Hebrew day/month names where appropriate

### Requirement: WhatsApp message language
WhatsApp notifications and agent responses SHALL be sent in the customer's preferred language. Language preference SHALL be detected from the customer's first message and stored for future interactions.

#### Scenario: Customer who previously communicated in Arabic
- **WHEN** the system sends a reminder to a customer whose language preference is Arabic
- **THEN** the reminder message is in Arabic

### Requirement: shadcn/ui components respect RTL direction
All shadcn/ui and Radix UI components SHALL render correctly in RTL mode. Sheet SHALL slide from the inline-end (right in LTR, left in RTL). DropdownMenu, Select, and Dialog SHALL position correctly in both directions.

#### Scenario: Sheet direction in Hebrew
- **WHEN** the locale is Hebrew and the mobile sidebar Sheet opens
- **THEN** the Sheet slides in from the left side (inline-end in RTL)

#### Scenario: Dropdown positioning in Arabic
- **WHEN** the locale is Arabic and a DropdownMenu opens
- **THEN** the menu aligns correctly relative to the trigger in RTL layout

### Requirement: Logical CSS properties in all new components
All newly created or modified components SHALL use CSS logical properties (`margin-inline-start`, `padding-inline-end`, `border-inline-start`, etc.) instead of physical direction properties (`margin-left`, `padding-right`, etc.).

#### Scenario: Sidebar border in RTL
- **WHEN** the sidebar renders in RTL mode
- **THEN** the border appears on the left side (inline-start) using `border-inline-end` / `border-e` Tailwind class
