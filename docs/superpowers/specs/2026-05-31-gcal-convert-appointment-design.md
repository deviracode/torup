# GCal Event → Appointment Conversion Design

**Goal:** Allow managers to click a Google Calendar event block in the daily or weekly calendar and convert it into a confirmed appointment in the system.

**Architecture:** A new `GCalConvertModal` component is triggered by clicking any 📅 GCal block. It reuses the existing customer search/create pattern from `NewAppointmentForm` and posts to the existing `POST /appointments` endpoint with `status: "confirmed"`.

**Tech Stack:** React, Next.js App Router, existing `apiFetch` helper, existing appointments API.

---

## Component: `GCalConvertModal`

File: `apps/web/src/components/dashboard/gcal-convert-modal.tsx`

**Props:**
- `event: { google_event_id: string; summary: string; start_time: string; end_time: string }` — the GCal event to convert
- `businessId: string`
- `token: string`
- `onClose: () => void`
- `onCreated: () => void` — called after successful appointment creation

**Modal header:** Shows the GCal event summary and formatted start time (read-only). Start time is locked — not editable.

**Form fields:**
1. **Service** (required) — dropdown fetched from `GET /businesses/:id/services`. End time is computed server-side from `service.duration_minutes`.
2. **Customer** (required) — searchable dropdown (`GET /businesses/:id/customers?search=`) with inline "Create new" option (name + phone fields).
3. **Notes** (optional) — textarea.

**No fields for:** date, time slot, status (always "confirmed"), staff (omitted for simplicity).

**Submit:**
1. If new customer: `POST /businesses/:id/customers` → get `customer_id`
2. `POST /businesses/:id/appointments` with:
   - `service_id`, `customer_id`, `start_time` (from GCal event), `notes`
   - `created_via: "manual"`, `status: "confirmed"`
3. On success: call `onCreated()` + `onClose()`
4. On error: show inline error message

---

## Calendar Changes

**`daily-calendar.tsx`:** GCal event div becomes a `<button>`, sets `selectedGcalEvent` state. Renders `GCalConvertModal` when `selectedGcalEvent` is set.

**`weekly-calendar.tsx`:** Same pattern — GCal event div becomes a `<button>`, same modal wiring.

---

## No Backend Changes

The existing `POST /appointments` endpoint already supports `status: "confirmed"` when `created_via: "manual"`. No API changes needed.
