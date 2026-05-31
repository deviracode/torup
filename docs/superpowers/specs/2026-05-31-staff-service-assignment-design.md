# Staff-Service Assignment Design

**Goal:** Allow managers to assign services to staff members, enforce that bookings only succeed when an assigned staff member is available, and auto-assign the staff member at booking time.

**Architecture:** New `staff_services` join table. Availability engine gains per-staff slot checking when staff are assigned to a service. Booking auto-assigns the first free staff member. Staff management UI shows names and opens a modal for service assignment.

**Tech Stack:** Supabase (PostgreSQL), Express API, React/Next.js, existing `getAvailableSlots` engine in `@torup/shared`.

---

## Database

### New migration: `supabase/migrations/00016_staff_services.sql`

```sql
CREATE TABLE IF NOT EXISTS staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(staff_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_services_staff ON staff_services(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service ON staff_services(business_id, service_id);
```

**Fallback rule:** If a service has zero rows in `staff_services`, availability behaves exactly as today (capacity-based, no staff constraint). This ensures existing businesses with no staff assignments are unaffected.

---

## API Changes

### `apps/api/src/routes/staff.ts`

**GET `/businesses/:businessId/staff`** — extend response to include `service_ids: string[]` per member. Fetches `staff_services` for the business and joins into the member list.

**GET `/businesses/:businessId/staff/:memberId/services`** — returns `{ service_ids: string[] }`.

**PUT `/businesses/:businessId/staff/:memberId/services`** — accepts `{ service_ids: string[] }`, replaces all assignments for that staff member using delete + insert.

### `apps/api/src/routes/availability.ts`

When `staff_services` rows exist for the requested service:

1. Fetch all staff assigned to this service (`staff_services` where `service_id = X`).
2. For each assigned staff member, fetch their appointments for the day.
3. A slot is **available** if at least one assigned staff member has no overlapping appointment during `[slotStart, slotEnd + buffer]`.
4. `available_capacity` = count of free staff members for that slot.

If no staff are assigned to the service, fall back to current capacity logic unchanged.

### `apps/api/src/routes/appointments.ts` (POST)

After validating the slot, if the service has assigned staff:

1. Find assigned staff members.
2. Pick the first one with no conflicting appointment.
3. Set `staff_id` on the new appointment.

If no staff are assigned, `staff_id` remains null.

### WhatsApp agent: `services/whatsapp-agent/src/index.ts`

`getAvailableTimeSlots` needs the same per-staff availability logic. Add staff-service check: fetch `staff_services` for the service, then for each slot verify at least one assigned staff member is free.

---

## Frontend

### Staff Management tab (`apps/web/src/app/[locale]/dashboard/settings/page.tsx`)

**Current:** Shows role badge + delete button per member. No name visible.

**New:** Shows `display_name` prominently + role badge. Clicking the row opens `StaffServicesModal`.

### New component: `apps/web/src/components/dashboard/staff-services-modal.tsx`

- Props: `member`, `businessId`, `token`, `onClose`, `onSaved`
- Fetches active services on mount
- Shows a checkbox list: one checkbox per service
- Pre-checks the member's current `service_ids`
- Save button calls `PUT /staff/:memberId/services`
- Shows "no services assigned = available for all bookings (legacy mode)" note

---

## Invariants

- Deleting a staff member cascades and removes their `staff_services` rows.
- Deleting a service cascades and removes its `staff_services` rows.
- A staff member with zero assignments does NOT block any service — only staff members with ≥1 assignment participate in per-staff checking for those specific services.
- Auto-assignment picks the first available staff member ordered by `created_at` (deterministic, simple).
