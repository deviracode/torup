## MODIFIED Requirements

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
