# Staff Service Assignment & Time-Off Design

## Goal

Allow business owners to edit staff members (display name, assigned services, time-off dates). When a staff member is the only one qualified for a service and goes on time-off, that service's effective capacity automatically drops to 0 on those dates — no manual intervention needed.

## Architecture

Staff-service assignments are stored in a new `staff_services` join table. Time-off reuses the existing `breaks` table with `staff_id` set. The availability engine derives effective capacity from qualified-and-available staff count rather than the static `service.max_capacity` field. Backwards compatibility is preserved: services with no staff assignments continue using `max_capacity` as before.

## Tech Stack

Next.js App Router (web), Express + Supabase (API), existing `breaks` + `business_members` + `services` tables, `packages/shared` scheduling engine.

---

## Database

### New table: `staff_services`

```sql
CREATE TABLE staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(staff_id, service_id)
);
CREATE INDEX idx_staff_services_staff ON staff_services(staff_id);
CREATE INDEX idx_staff_services_service ON staff_services(service_id);
```

### Time-off storage

Reuses `breaks` table. Each time-off day is one row with:
- `staff_id` = the member's id
- `type = 'one_time'`
- `specific_date` = the date (YYYY-MM-DD)
- `start_time = '00:00'`, `end_time = '23:59'` (full-day block)
- `label` = 'time_off'

Date ranges are expanded on write (one row per day). The UI groups consecutive rows back into ranges for display.

### No changes to `services.max_capacity`

It remains as the fallback for services with no staff assignments.

---

## Availability Engine Change

File: `apps/api/src/routes/availability.ts`

**Current:** `effectiveCapacity = service.max_capacity`

**New logic:**
1. Query `staff_services` for rows where `service_id` matches.
2. If **no rows exist** → `effectiveCapacity = service.max_capacity` (unchanged, backwards compat).
3. If **rows exist** → for each assigned staff member, check if they have a `breaks` row with `staff_id = member.id` AND `specific_date = date` AND full-day coverage (`start_time <= '00:01'` and `end_time >= '23:58'`). Count members with no such row → `effectiveCapacity = that count`.
4. If `effectiveCapacity = 0`, return no slots for that date.

Both queries (staff_services + breaks for staff) are fetched in the existing `Promise.all` block alongside working_hours and breaks.

---

## API Endpoints

All routes require `requireAuth + requireBusinessAccess`. Write routes also require `requireRole('business_owner', 'super_admin')`.

### PATCH `/businesses/:businessId/staff/:memberId`
Update display name.
- Body: `{ display_name: string }`
- Updates `business_members.display_name`
- Returns updated member row

### GET `/businesses/:businessId/staff/:memberId/services`
Returns assigned service IDs.
- Response: `{ service_ids: string[] }`

### PUT `/businesses/:businessId/staff/:memberId/services`
Replace full service assignment list.
- Body: `{ service_ids: string[] }`
- Deletes all existing `staff_services` rows for this member, inserts new ones.
- Returns `{ service_ids: string[] }`

### GET `/businesses/:businessId/staff/:memberId/time-off`
Returns time-off entries grouped into ranges.
- Response: `{ ranges: { id: string; start_date: string; end_date: string; break_ids: string[] }[] }`
- Consecutive `specific_date` rows with `label = 'time_off'` are merged into ranges client-side.

### POST `/businesses/:businessId/staff/:memberId/time-off`
Add a time-off range.
- Body: `{ start_date: string; end_date: string }` (YYYY-MM-DD)
- Expands range, inserts one `breaks` row per day with `staff_id` set.
- Returns inserted break rows.

### DELETE `/businesses/:businessId/staff/:memberId/time-off`
Remove a time-off range.
- Body: `{ break_ids: string[] }` (all ids from a grouped range)
- Deletes those specific break rows.

### GET `/businesses/:businessId/staff` (enriched)
Existing endpoint extended to also return `service_ids` and `time_off_ranges` per member, so the settings page loads in one request.

---

## UI — Settings → Staff Management

Each staff member row expands into an edit panel. The panel has three sections:

**Display Name**
- Text input pre-filled with current `display_name`.
- Save button triggers `PATCH .../staff/:memberId`.

**Assigned Services**
- Checkbox list of all active business services.
- Pre-checked based on current `service_ids`.
- On change, calls `PUT .../staff/:memberId/services` with full updated list.
- Services with no assigned staff anywhere show a ⚠️ badge: "uses fixed capacity".

**Time-Off**
- Two date inputs: start + end (min = today).
- "Add" button posts the range.
- Existing ranges shown as chips: "Jun 20 – Jun 27 ×".
- × button deletes the range (all its break_ids).
- Overlapping ranges are rejected client-side before submission.

---

## Error Handling

- `PUT .../services` with a non-existent `service_id` → 400.
- `POST .../time-off` with `end_date < start_date` → 400.
- `POST .../time-off` with range > 365 days → 400 (safety cap).
- `PATCH display_name` with empty string → 400.
- All write operations clear the availability cache (`cacheClear`) for the business so slots reflect the change immediately.

---

## Migration

One migration file: `00022_staff_services.sql`
- Creates `staff_services` table with indexes.
- No data backfill needed (existing services default to no assignments = use `max_capacity`).
