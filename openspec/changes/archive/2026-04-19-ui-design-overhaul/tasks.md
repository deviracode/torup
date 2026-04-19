## 1. Design System Foundation

- [x] 1.1 Install shadcn/ui dependencies (`@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-separator`, `@radix-ui/react-label`, `@radix-ui/react-avatar`) into `@queue/ui`
- [x] 1.2 Install `lucide-react` into `@queue/web`
- [x] 1.3 Add shadcn/ui CSS variables (color palette, radius, font) to `apps/web/src/app/globals.css`
- [x] 1.4 Add shadcn/ui utility function `cn()` to `@queue/ui` (or verify existing `utils.ts`)
- [x] 1.5 Add core shadcn/ui components to `@queue/ui`: Button (upgrade existing), Input, Label, Card, Badge, Separator, Skeleton
- [x] 1.6 Add overlay shadcn/ui components to `@queue/ui`: Dialog, Sheet, Select, DropdownMenu, Tabs
- [x] 1.7 Add data display components to `@queue/ui`: Table, Avatar
- [x] 1.8 Re-export all new components from `@queue/ui` index

## 2. Auth Pages Redesign

- [x] 2.1 Redesign login page — centered Card layout with logo, Input/Label pairs, styled Button
- [x] 2.2 Redesign register page — same Card layout, matching style
- [x] 2.3 Redesign forgot-password page — Card with email Input and submit Button
- [x] 2.4 Redesign reset-password page — Card with password Inputs

## 3. Landing Page Redesign

- [x] 3.1 Redesign home page — hero section with gradient background, tagline, and CTA Buttons
- [x] 3.2 Add feature highlights section with icon Cards (calendar, WhatsApp, analytics, multilingual)
- [x] 3.3 Add footer with links to terms, privacy, data-deletion pages

## 4. Booking Flow Redesign

- [x] 4.1 Add step indicator component (numbered steps with active/completed/upcoming states)
- [x] 4.2 Redesign service selection — Card grid with service name, duration, price, selected state
- [x] 4.3 Redesign date selection — styled date input or date picker with Card wrapper
- [x] 4.4 Redesign time slot selection — responsive grid of Badge/pill components
- [x] 4.5 Redesign details form — Card with Input/Label for name, phone, notes
- [x] 4.6 Redesign confirmation step — summary Card with all booking details and confirm Button
- [x] 4.7 Redesign success state — check icon, confirmation message, action to view booking

## 5. Dashboard Sidebar & Layout

- [x] 5.1 Replace emoji icons with Lucide icons in sidebar navigation (Calendar, Users, Scissors, Settings, BarChart3, CreditCard)
- [x] 5.2 Style sidebar with updated colors, active states, and business name/logo area
- [x] 5.3 Add mobile responsive sidebar using Sheet component (hamburger menu trigger)
- [x] 5.4 Add top bar for mobile with business name and hamburger button
- [x] 5.5 Add dashboard overview stat Cards (today's appointments, pending, completed, revenue) to dashboard home page

## 6. Dashboard Calendar & Modals

- [x] 6.1 Restyle daily calendar appointment blocks using Card components and status Badge
- [x] 6.2 Restyle weekly calendar with consistent Card and Badge usage
- [x] 6.3 Redesign appointment modal using Dialog — sections for customer info, service, time, status actions
- [x] 6.4 Redesign new appointment form using Dialog with Input/Label/Select components

## 7. Dashboard Pages

- [x] 7.1 Redesign services page — Table for service list, Dialog for add/edit form with Input/Label/Select
- [x] 7.2 Redesign customers page — Table with search, customer detail row
- [x] 7.3 Redesign settings page — Tabs for sections, Input/Label/Select for all form fields
- [x] 7.4 Redesign analytics page — stat Cards with Lucide icons, clear number formatting
- [x] 7.5 Redesign billing page — plan Cards, usage display

## 8. Admin Panel Redesign

- [x] 8.1 Redesign admin businesses tab — Table with sortable columns, status Badge, action DropdownMenu
- [x] 8.2 Redesign onboarding form — Dialog with Input/Label/Select components
- [x] 8.3 Redesign admin analytics page — platform stat Cards with icons
- [x] 8.4 Style admin sidebar/navigation consistent with dashboard

## 9. RTL & Polish

- [x] 9.1 Verify all shadcn/ui components render correctly in RTL (Hebrew/Arabic)
- [x] 9.2 Ensure Sheet opens from correct side in RTL
- [x] 9.3 Verify DropdownMenu and Select positioning in RTL
- [x] 9.4 Audit all new components for logical CSS properties (no physical left/right)
- [x] 9.5 Visual review and fix any spacing, alignment, or color inconsistencies across all pages
