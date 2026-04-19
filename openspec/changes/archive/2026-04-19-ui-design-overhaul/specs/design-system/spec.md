## ADDED Requirements

### Requirement: Shared component library via shadcn/ui
The `@queue/ui` package SHALL provide shadcn/ui components built on Radix UI primitives. Components SHALL include: Button, Input, Label, Card, Dialog, Sheet, Select, Badge, Table, Tabs, Separator, DropdownMenu, Avatar, and Skeleton.

#### Scenario: Component import from shared package
- **WHEN** a developer imports `import { Button, Card, Input } from "@queue/ui"`
- **THEN** the components render correctly with shadcn/ui styling and Radix accessibility

### Requirement: Lucide icon set
All UI icons SHALL use `lucide-react` SVG icons instead of emoji characters. Icons SHALL be tree-shakeable and render at consistent sizes.

#### Scenario: Icon rendering in sidebar
- **WHEN** the dashboard sidebar renders navigation items
- **THEN** each item displays a Lucide SVG icon (e.g., Calendar, Users, Scissors, Settings, BarChart3, CreditCard) instead of emoji

### Requirement: CSS variable-based theming
The design system SHALL define a color palette using CSS custom properties (`--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, etc.) following the shadcn/ui convention. The primary color SHALL be configurable.

#### Scenario: Theme colors applied
- **WHEN** the app loads
- **THEN** all shadcn/ui components use the CSS variable palette defined in the global stylesheet

### Requirement: Consistent typography and spacing
The design system SHALL establish a typography scale (headings, body, small) and spacing scale via Tailwind configuration consistent with shadcn/ui defaults.

#### Scenario: Typography consistency
- **WHEN** any page renders headings and body text
- **THEN** font sizes, weights, and line heights follow the design system scale
