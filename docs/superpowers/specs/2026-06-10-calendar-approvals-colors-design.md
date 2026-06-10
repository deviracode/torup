# Calendar & Approvals Improvements — Design Spec

**Date:** 2026-06-10  
**Status:** Approved

---

## Overview

Three related improvements to the dashboard calendar and appointment approval workflow:

1. Side-by-side pending approvals panel + calendar (replacing the blur overlay drawer)
2. Calendar stays on the approved appointment's date after approval
3. Lighter calendar colors with per-service color coding

---

## Feature 1 — Side-by-side Pending Approvals + Calendar

### Problem

Clicking the "Pending Approvals" stat card opens a full-screen drawer with a blur backdrop that completely obscures the calendar. The user cannot check availability while reviewing requests.

### Solution

Replace the blur drawer with a split-view layout. Clicking "Pending Approvals" toggles `splitMode` state on the dashboard page.

### Layout

When `splitMode` is active:
- Stat cards remain at the top (unchanged)
- Below the stat cards, the layout becomes a two-column flex row:
  - **Left column (fixed ~380px):** Inline approvals list panel
  - **Right column (flex-1):** The `DailyCalendar` component

### Approvals Panel (left column)

- Header: "Pending Approvals" title + "×" close button (sets `splitMode = false`)
- Scrollable list of `pending_approval` appointments
- Each card shows: customer name, date + time, service name, Approve / Reject buttons
- Clicking a card navigates the calendar to that appointment's date

### Calendar sync

`DailyCalendar` gains a `controlledDate?: string` prop. When provided, the calendar initializes to that date instead of today. The user can still navigate freely with the prev/next buttons. The parent updates `controlledDate` whenever an approval card is clicked.

### Dismissal

The "×" button in the approvals panel header sets `splitMode = false`, returning to the normal single-column layout.

---

## Feature 2 — Stay on Date After Approval

### Problem

After approving an appointment, `refreshKey` increments, causing `DailyCalendar` to remount and reset to today. The user must re-navigate to the relevant date.

### Solution

When `handleApprove` is called:
1. Extract the date from the approved appointment's `start_time`
2. Set `selectedDate` (passed as `controlledDate` to the calendar) to that date
3. Then increment `refreshKey`

The calendar remounts on the appointment's date instead of today.

This applies in both split mode and the legacy stat-card drawer. In the drawer case, after approval the user sees the calendar has navigated to the approved date when they close the drawer.

---

## Feature 3 — Per-Service Color Coding

### 3a — Database Migration

Add a `color` column to the `services` table:
- Type: `text`, nullable
- A random pleasant hex color (e.g. from a curated palette) is generated server-side and stored when a new service is created without a color

### 3b — Services Settings UI

In the existing service edit/create form:
- Add a color field: a clickable color swatch circle
- Clicking opens a native `<input type="color">`
- The selected color is saved via the existing services PATCH API
- New services auto-populate with a random color from the server

### 3c — Calendar Rendering

The `Appointment` type in `daily-calendar.tsx` and `weekly-calendar.tsx` gains:
```ts
services?: { ..., color?: string | null }
```

Appointment card styling when `services.color` is set:
- Background: `${color}2e` (hex with ~18% opacity suffix)
- Left border: `${color}` at full opacity (3px solid)
- Text (name, service label): `${color}cc` (80% opacity — bright tint)
- Time text: `${color}99` (60% opacity)

Falls back to existing `STATUS_COLORS` map if no service color is present.

Both `STATUS_COLORS` in `daily-calendar.tsx` and `weekly-calendar.tsx` remain as fallback for appointments without a service color (e.g. cancelled, no_show).

---

## Files Affected

| File | Change |
|------|--------|
| `apps/web/src/app/[locale]/dashboard/page.tsx` | Add `splitMode` state, split-view layout, `controlledDate` wiring, updated `handleApprove` |
| `apps/web/src/components/dashboard/daily-calendar.tsx` | Add `controlledDate` prop, update `Appointment` type with `color`, service-color rendering |
| `apps/web/src/components/dashboard/weekly-calendar.tsx` | Same `Appointment` type + service-color rendering changes |
| Services settings form (to be located) | Add color picker field |
| `services/api` | Migration + random color generation on service create |

---

## Out of Scope

- Weekly calendar split-view (approvals panel only works alongside the daily calendar)
- Color themes / dark mode toggle
- Custom status colors
