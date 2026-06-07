# Calendar Improvements — Design Spec
**Date:** 2026-06-07

## Overview

Four targeted improvements to the dashboard calendar:
1. Hide cancelled/no-show appointments from calendar view
2. Reschedule appointments (drag-and-drop + modal button)
3. Fix capacity enforcement so services with max_capacity > 1 allow parallel bookings
4. Smart date navigation (month/year jump + quick shortcuts)

---

## Section 1: Hide Cancelled Appointments

**Problem:** Cancelled and no-show appointments currently render on the calendar with muted styling, cluttering the view.

**Fix:** Filter `cancelled` and `no_show` out of the rendered list in both calendar components. They remain visible in the appointment detail modal and the appointments list page.

**Files changed:**
- `apps/web/src/components/dashboard/daily-calendar.tsx` — filter appointments before map
- `apps/web/src/components/dashboard/weekly-calendar.tsx` — same filter

**Implementation:** One-line filter before the render loop:
```ts
appointments.filter(a => a.status !== "cancelled" && a.status !== "no_show")
```

---

## Section 2: Reschedule Appointments

### 2a. Modal "Reschedule" button

**Trigger:** Shown for appointments in `pending_approval`, `pending`, or `confirmed` status.

**UI:** A "Reschedule 🗓" button inside `appointment-modal.tsx`. Clicking it renders an inline date input + grouped time slots (same UI as the new-appointment form). On confirm:
1. Call `PATCH /businesses/:businessId/appointments/:appointmentId/reschedule` with `{ start_time }`
2. Modal closes, calendar refreshes

**Validation:** Endpoint checks availability before accepting. Returns 409 if slot is at capacity.

### 2b. Drag-and-drop on daily calendar

**Drag source:** Each appointment block gets `draggable={true}`. Disabled for `completed`, `cancelled`, `no_show`.

**Drop target:** Each hour row in the daily grid is a drop zone.

**On drop:**
1. Compute new `start_time` from the target row's hour
2. Optimistically reposition the block in UI
3. Call `PATCH /reschedule` — revert on error, show toast

**Weekly calendar:** Drag not implemented (too compact). Modal button handles it.

### 2c. New API endpoint

```
PATCH /businesses/:businessId/appointments/:appointmentId/reschedule
Body: { start_time: string }
```

Logic:
1. Fetch appointment + service duration
2. Compute `end_time = start_time + duration_minutes`
3. Check availability (slot must have `available_capacity > 0`)
4. Update `start_time` + `end_time`
5. Return updated appointment

Returns 409 if slot is full, 404 if appointment not found, 400 if status disallows reschedule (completed/cancelled).

---

## Section 3: Capacity Enforcement Fix

### Root cause

`POST /appointments` does not validate capacity before inserting — it only requires a customer and service. The availability API correctly returns `available_capacity` per slot but the booking path ignores it.

### Fix — API

Both `POST /appointments` and `PATCH /reschedule` must:
1. Call the availability check for the requested slot
2. Reject with 409 if `available_capacity === 0`

### Fix — UI: capacity indicator in time slots

In `new-appointment-form.tsx`, the time slot buttons currently show just `"14:00"`. When a slot is partially filled (`available_capacity < total_capacity`), display:
```
14:00 (1/2)
```
Fully booked slots (`available_capacity === 0`) remain hidden.

The availability API already returns `available_capacity` and `total_capacity` — no backend change needed for the indicator.

### Fix — drag-and-drop

Before firing `PATCH /reschedule` on drop, fetch availability for the target slot. If `available_capacity === 0`, show error toast and revert the drag. Do not call PATCH.

---

## Section 4: Smart Date Navigation

### 4a. Month/year popup on calendar header

**Trigger:** Clicking the current month+year label (e.g. "יוני 2026") in both daily and weekly calendar headers.

**Popup content:**
- Year selector: `← 2025  2026  2027 →`
- 12 month buttons in a 3×4 grid (Jan–Dec), current month highlighted
- Clicking a month jumps the calendar to the 1st of that month and closes the popup
- Clicking outside closes without navigating

**Implementation:** Plain `div` with `absolute` positioning + `z-50`. No library. State: `showMonthPicker: boolean`.

### 4b. Quick date shortcuts in new appointment form

Below the `<input type="date">` in `new-appointment-form.tsx`, add a row of pill buttons:

```
[ Today ]  [ Tomorrow ]  [ +1 week ]  [ +1 month ]
```

Each sets the date field to the corresponding value. The native date input remains for precise entry. Shortcuts respect the `min`/`max` bounds (today → today + maxFutureDays).

---

## What Does NOT Change

- Appointment status transitions (state machine unchanged)
- WhatsApp bot flow
- Customer-facing booking page (`/b/[slug]`)
- Notification system (approval/rejection messages)

---

## Summary Table

| # | Change | Files |
|---|--------|-------|
| 1 | Filter cancelled/no-show from calendar | daily-calendar.tsx, weekly-calendar.tsx |
| 2 | Reschedule modal button | appointment-modal.tsx |
| 2 | Drag-and-drop daily calendar | daily-calendar.tsx |
| 2 | Reschedule API endpoint | apps/api/src/routes/appointments.ts |
| 3 | Capacity validation in booking | apps/api/src/routes/appointments.ts |
| 3 | Capacity indicator in time slots | new-appointment-form.tsx |
| 4 | Month/year popup picker | daily-calendar.tsx, weekly-calendar.tsx |
| 4 | Quick date shortcuts | new-appointment-form.tsx |
