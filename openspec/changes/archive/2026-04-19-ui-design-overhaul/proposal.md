## Why

The current UI is built with raw Tailwind utility classes and emoji icons, resulting in a basic, inconsistent look that undermines trust for paying business owners and their customers. There is no design system — every page hand-rolls its own buttons, cards, inputs, and layouts. Upgrading to a polished component library will dramatically improve perceived quality, development speed, and visual consistency across the platform.

## What Changes

- **Install shadcn/ui** into `@queue/ui` — it builds on the existing `class-variance-authority`, `clsx`, and `tailwind-merge` already in the package, plus adds Radix UI primitives and Lucide icons
- **Replace all emoji icons** (📅 👥 ✂️ ⚙️ 📊 💳) with Lucide SVG icons throughout sidebar, calendars, and booking flow
- **Redesign the landing page** (`/[locale]/page.tsx`) — hero section with gradient, feature cards, social proof, and clear CTAs
- **Redesign the booking flow** (`booking-flow.tsx`) — step indicator, polished cards for service selection, date picker, time slot grid, and confirmation
- **Redesign the dashboard** — sidebar with proper icons and collapsible mobile drawer, stat cards on overview, improved calendar views, polished modals and forms
- **Redesign auth pages** (login, register, forgot/reset password) — centered card layout with branding
- **Redesign the admin panel** — data tables with sorting/filtering, stat overview cards
- **Add a consistent color palette and design tokens** — primary brand color, semantic colors, spacing scale, typography scale
- **Improve RTL support** — ensure all new components use logical CSS properties and render correctly in Hebrew/Arabic

## Capabilities

### New Capabilities
- `design-system`: Core design tokens, shared shadcn/ui components in `@queue/ui`, Lucide icon set, and theming configuration

### Modified Capabilities
- `web-booking-page`: Visual redesign of the public booking flow — new step indicator, card-based service picker, time slot grid
- `business-dashboard`: Visual redesign of sidebar navigation, calendar views, appointment modals, forms, and analytics charts
- `super-admin-panel`: Visual redesign of business table, onboarding form, and admin analytics
- `i18n-rtl`: Ensure all new Radix/shadcn components respect RTL layout via logical properties

## Impact

- **Dependencies**: Adds `@radix-ui/*` primitives, `lucide-react`, and shadcn/ui component files to `@queue/ui` and `@queue/web`
- **Code**: Touches every page and component in `apps/web/src/` — mostly template/JSX changes, minimal logic changes
- **No API changes**: Backend is unaffected; this is purely a frontend visual overhaul
- **No breaking changes**: All routes, data flows, and functionality remain identical
