# Dashboard UI Modernization — Design Spec

**Date:** 2026-08-07
**Status:** Approved (brainstorming session)
**Scope:** The entire logged-in dashboard experience (shell, settings, calendar, modals, pages) — frontend only.

## 1. Goal

Modernize the dashboard's UI components from a "Material-era" feel to first-class, modern web components — while **preserving the existing brand and style** (dark indigo + amber theme, Heebo font, RTL, gradients). The visual identity stays; the primitives and interaction patterns get upgraded, and the result becomes a reusable component foundation for the whole frontend.

## 2. Current State Findings

- `apps/web/src/app/[locale]/dashboard/settings/page.tsx` — 1,079-line monolith, 10 tabs, hand-rolled tab bar (border-bottom buttons), raw `<input type="time">`, raw `<select>`, inline `blue-600` save buttons, hand-rolled success banner (`bg-green-50`) instead of sonner (sonner is already a dependency and used elsewhere).
- Dashboard pages: home (535 lines), customers (196), settings (1,079), services (337), billing (72), analytics (155).
- Dashboard components: sidebar, top-bar, daily/weekly calendars, appointment-modal, new-appointment-form, staff-card, pending-approvals-panel, gcal-convert-modal, month-year-picker, whatsapp-settings (~3,150 lines total).
- `packages/ui` (@torup/ui): 16 shadcn-style components (CVA + Radix + Tailwind v4 + tailwind-merge). Exists but is under-used by the dashboard.
- Stack: Next.js 15 (App Router), React 19, Tailwind CSS v4, framer-motion, lucide-react, sonner, next-intl (he/ar/en, RTL), Supabase via `useApi` + `useBusiness` hooks.
- Tests: API has vitest; web and ui packages have no test runner (only `tsc --noEmit`).

## 3. Design Principles

1. **Keep the brand.** Dark indigo primary (hsl 239 84% 67%), amber accent, existing design tokens and gradients in `globals.css` are untouched.
2. **Everything interactive comes from `@torup/ui`.** No raw `<select>`, `<input type="time">`, hand-rolled banners, or inline-styled buttons anywhere in the dashboard.
3. **Reusable foundation first.** The component set must be generic enough for the public booking site to adopt later.
4. **RTL-safe and accessible.** All new components respect `dir="rtl"`, keyboard navigation, focus rings.
5. **Subtle motion.** 150–250ms transitions, fade/slide on tab switch, staggered list entrance, press feedback, hover lift. Respects `prefers-reduced-motion`. Logical properties only.
6. **No backend changes.** Data flow (useApi + businessId) stays as-is.

## 4. Component Foundation (`packages/ui`)

### 4.1 Upgrades to existing components
- **Button** — add `loading` prop (inline spinner + disabled).
- **Tabs** — animated active indicator (framer-motion `layoutId`), icon support on triggers, horizontally scrollable when overflowing.
- **Select** — restyled trigger (chevron, focus ring); plus a searchable **Combobox** variant for long lists.
- **Badge** — full variant set: success / warning / info / destructive / neutral + dot variants.
- **Input** — error-state styling.
- **Field** — new wrapper composing label + hint + error + control.
- Skeleton, Dialog, Sheet, Tooltip — kept, and actually used.

### 4.2 New primitives
- **Switch** (Radix) — replaces plain checkboxes for on/off toggles.
- **RadioGroup** (Radix) — styled single-choice (price type, break type).
- **Checkbox** (Radix) — styled multi-select.
- **DatePicker + Calendar** (react-day-picker + Radix popover) — one-off breaks, filters.
- **TimePicker** — custom segmented hour/minute control; RTL-safe; replaces native time inputs.
- **EmptyState** — icon + title + description + action.
- **SegmentedControl** — 2–3 choice groups (open/closed, recurring/one-time).
- **FormSection / SettingRow** — grouped settings layout: label + description on one side, control on the other, section dividers. Kills the "long vertical list" feel.
- **Spinner**, **Toaster** (sonner wrapper) — consistent feedback everywhere.
- **Motion helpers** — `FadeIn`, `StaggerGroup`, `AnimatedPresence` (framer-motion wrappers).

### 4.3 New dependencies (small, standard, tree-shaken)
- `@radix-ui/react-switch`, `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-popover`
- `react-day-picker`
- `react-hook-form` + `zod` + `@hookform/resolvers` (only for forms that earn it: appointment, staff, services)
- `cmdk` (Combobox) — or a hand-rolled filter if simpler
- Testing: `vitest`, `@testing-library/react`, `jsdom` in `packages/ui` and `apps/web`

## 5. Settings Rebuild (flagship)

Split the 1,079-line `settings/page.tsx` into a thin shell + per-tab components under `apps/web/src/components/dashboard/settings/`:

```
settings/
  page.tsx              → shell: header, animated tab nav, renders active tab
  working-hours-tab.tsx
  breaks-tab.tsx
  reminders-tab.tsx
  booking-rules-tab.tsx
  staff-tab.tsx
  profile-tab.tsx
  booking-tab.tsx
  gcal-tab.tsx
  services-tab.tsx
  whatsapp-tab.tsx      → wraps restyled WhatsAppSettings
```

- Each tab owns its fetch (existing useApi + businessId) and save logic. No backend changes.
- Per-tab UX:
  - **Working hours** — Switch for closed days, TimePicker, save with loading state.
  - **Breaks** — list with badges + delete confirmation Dialog; add-form with RadioGroup (recurring/one-time), day Select, TimePicker.
  - **Reminders** — preset chips (15min→48h) toggleable, Switch to activate.
  - **Rules** — FormSection/SettingRow groups, steppers for numbers.
  - **Staff** — restyled StaffCard, add/edit Dialog + validated form, EmptyState.
  - **Profile** — FormSection groupings, save per section.
  - **Booking** — toggles + numeric fields, logical sections.
  - **Google Calendar** — status Badge, connect/disconnect, sync toggles.
  - **Services** — modern list with badges, add/edit Dialog, keeps sort order.
  - **WhatsApp** — restyle existing component, connection status Badge.
- Cross-cutting: skeleton per tab while fetching; error state with retry; sonner toasts (replaces the green banner); animated scrollable tab nav with icons per tab; all new strings in `packages/i18n/messages/{he,ar,en}.json`, Hebrew-first.

## 6. Dashboard-Wide Application

- **Sidebar** — consistent icons, animated active indicator, tooltips on collapse, mobile drawer via Sheet.
- **Top bar** — restyled slots consistent with the new language.
- **Home** — stat cards with hover lift, skeleton loading, unified cards; pending approvals restyled (Badges, EmptyState, item motion).
- **Calendars (daily/weekly)** — light-touch chrome pass only (not a rewrite): consistent controls (MonthYearPicker → DatePicker style), appointment-block hover states, motion on modal open/close, consistent buttons. Scheduling logic untouched.
- **Appointment modal + new-appointment form** — Dialog + react-hook-form + zod with real validation, modern selects/date pickers, loading states, success toast.
- **Customers** — modernized table: search, status badges, empty state.
- **Services** — consistent list/dialog treatment.
- **Billing** — badge-based status cards.
- **Analytics** — consistent stat cards + skeletons.
- **Staff cards, pending approvals, gcal-convert modal** — restyled to shared primitives.

## 7. Data Flow, Feedback, Error Handling, Motion

- **Data flow:** unchanged — `useApi` + `businessId`, same endpoints. Zero backend changes.
- **Saving:** toggles (Switch) save instantly with optimistic UI (roll back + toast on failure); multi-field sections keep explicit save buttons with loading states.
- **Feedback:** sonner toasts for success/error everywhere; inline field errors; button spinners during saves.
- **Errors:** tab fetch failure → inline error state with retry; save failure → toast with message, form data preserved.
- **Motion:** 150–250ms; fade/slide on tab switch; staggered lists; press feedback; hover lift; `prefers-reduced-motion` respected; RTL-safe logical properties.

## 8. Testing & Verification

- Add vitest + @testing-library/react + jsdom to `packages/ui` and `apps/web`.
- Component tests for new primitives (Switch toggles, Field error rendering, TimePicker value handling, Tab switching) and settings flow tests (tab render, save with mocked useApi).
- Existing gates stay: `pnpm type-check`, `pnpm lint`, `pnpm build` across the monorepo.
- Manual QA checklist: RTL (Hebrew) pass, keyboard navigation, focus rings, reduced-motion.
- Verification before completion: full build + tests green, dashboard walkthrough.

## 9. Out of Scope

- Backend / API changes (none).
- Public booking site, landing page, auth pages (they may adopt the foundation later).
- Brand/theme changes.
- Calendar scheduling logic rewrites.
- WhatsApp backend identity work.
