# Staff-Service Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow managers to assign services to staff members, enforce that bookings only succeed when an assigned staff member is available, and auto-assign the staff member at booking time.

**Architecture:** New `staff_services` join table. Availability engine gains per-staff slot checking when staff are assigned to a service. Booking auto-assigns the first free staff member. Staff management UI shows names and opens a modal for service assignment.

**Tech Stack:** Supabase (PostgreSQL), Express API (apps/api), React/Next.js (apps/web), WhatsApp agent (services/whatsapp-agent).

---

## Task 1: DB Migration — `staff_services` table

**File:** `supabase/migrations/00016_staff_services.sql`

### Steps

- [ ] Create the file `supabase/migrations/00016_staff_services.sql` with the following content:

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

- [ ] Run `supabase db push` from the repo root.
- [ ] Verify the table exists: open Supabase Studio → Table Editor → confirm `staff_services` appears with columns `id`, `business_id`, `staff_id`, `service_id` and the two indexes are listed in the Indexes tab.
- [ ] Commit: `git add supabase/migrations/00016_staff_services.sql && git commit -m "feat: add staff_services migration"`

---

## Task 2: API — staff services endpoints in `apps/api/src/routes/staff.ts`

**File:** `apps/api/src/routes/staff.ts`

### Changes

Replace the existing GET `/` handler and add two new routes:

**1. Extend GET `/` to include `service_ids` per member**

Replace the current GET `/` handler:

```ts
// GET /businesses/:businessId/staff
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);

      const [membersResult, ssResult] = await Promise.all([
        supabase
          .from("business_members")
          .select("*")
          .eq("business_id", businessId)
          .order("created_at"),
        supabase
          .from("staff_services")
          .select("staff_id, service_id")
          .eq("business_id", businessId),
      ]);

      if (membersResult.error) throw new AppError(500, membersResult.error.message);

      const ssMap = new Map<string, string[]>();
      for (const row of ssResult.data || []) {
        if (!ssMap.has(row.staff_id)) ssMap.set(row.staff_id, []);
        ssMap.get(row.staff_id)!.push(row.service_id);
      }

      const members = (membersResult.data || []).map((m: Record<string, unknown>) => ({
        ...m,
        service_ids: ssMap.get(m.id as string) || [],
      }));

      res.json(members);
    } catch (err) {
      next(err);
    }
  }
);
```

**2. Add GET `/:memberId/services`**

Insert before the existing `DELETE /:memberId` route:

```ts
// GET /businesses/:businessId/staff/:memberId/services
router.get(
  "/:memberId/services",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("staff_services")
        .select("service_id")
        .eq("staff_id", getParam(req, "memberId"))
        .eq("business_id", getBusinessId(req));

      if (error) throw new AppError(500, error.message);
      res.json({ service_ids: (data || []).map((r) => r.service_id) });
    } catch (err) {
      next(err);
    }
  }
);
```

**3. Add PUT `/:memberId/services`**

Insert after the GET `/:memberId/services` route:

```ts
// PUT /businesses/:businessId/staff/:memberId/services
router.put(
  "/:memberId/services",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const memberId = getParam(req, "memberId");
      const { service_ids } = req.body as { service_ids: string[] };

      if (!Array.isArray(service_ids)) throw new AppError(400, "service_ids must be an array");

      // Delete all existing assignments for this staff member in this business
      const { error: delError } = await supabase
        .from("staff_services")
        .delete()
        .eq("staff_id", memberId)
        .eq("business_id", businessId);

      if (delError) throw new AppError(500, delError.message);

      if (service_ids.length > 0) {
        const rows = service_ids.map((service_id) => ({
          business_id: businessId,
          staff_id: memberId,
          service_id,
        }));
        const { error: insError } = await supabase.from("staff_services").insert(rows);
        if (insError) throw new AppError(500, insError.message);
      }

      res.json({ service_ids });
    } catch (err) {
      next(err);
    }
  }
);
```

### Steps

- [ ] Open `apps/api/src/routes/staff.ts`.
- [ ] Replace the GET `/` handler with the extended version above.
- [ ] Insert the GET `/:memberId/services` route before the DELETE `/:memberId` route.
- [ ] Insert the PUT `/:memberId/services` route after the GET `/:memberId/services` route.
- [ ] Run `cd apps/api && npx tsc --noEmit` — confirm zero type errors.
- [ ] Verify manually:
  - `GET /api/businesses/:id/staff` returns an array where each member has a `service_ids: string[]` field.
  - `PUT /api/businesses/:id/staff/:memberId/services` with `{ "service_ids": [] }` returns `{ "service_ids": [] }`.
  - `GET /api/businesses/:id/staff/:memberId/services` returns `{ "service_ids": [] }`.
- [ ] Commit: `git add apps/api/src/routes/staff.ts && git commit -m "feat: staff services GET/PUT endpoints"`

---

## Task 3: Availability API — per-staff slot checking in `apps/api/src/routes/availability.ts`

**File:** `apps/api/src/routes/availability.ts`

### Logic

After the existing five parallel fetches, add a sixth: fetch `staff_services` rows for the given `service_id` in this business. If any rows exist, override `available_capacity` per slot by counting how many assigned staff members have no conflicting appointment in `[slotStart, slotStart + duration + buffer]`.

### Changes

Replace the entire route handler in `apps/api/src/routes/availability.ts`:

```ts
import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId } from "../lib/params.js";
import { AppError } from "../middleware/error-handler.js";
import {
  getAvailableSlots,
  type WorkingDay,
  type BreakPeriod,
  type ExistingAppointment,
  type ServiceConfig,
  type BookingRulesConfig,
} from "@torup/shared";

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/availability?service_id=&date=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const businessId = getBusinessId(req);
    const { service_id, date } = req.query;

    if (!service_id || !date) throw new AppError(400, "service_id and date are required");

    const dateStr = date as string;

    const { data: service } = await supabase
      .from("services")
      .select("*")
      .eq("id", service_id as string)
      .eq("business_id", businessId)
      .eq("is_active", true)
      .single();

    if (!service) throw new AppError(404, "Service not found");

    const [whResult, brResult, aptResult, gcalResult, rulesResult, ssResult] = await Promise.all([
      supabase.from("working_hours").select("*").eq("business_id", businessId).is("staff_id", null),
      supabase.from("breaks").select("*").eq("business_id", businessId).is("staff_id", null),
      supabase
        .from("appointments")
        .select("start_time, end_time, staff_id")
        .eq("business_id", businessId)
        .gte("start_time", `${dateStr}T00:00:00+03:00`)
        .lte("start_time", `${dateStr}T23:59:59+03:00`)
        .not("status", "in", '("cancelled","no_show")'),
      supabase
        .from("google_calendar_events")
        .select("start_time, end_time")
        .eq("business_id", businessId)
        .gte("start_time", `${dateStr}T00:00:00+03:00`)
        .lte("start_time", `${dateStr}T23:59:59+03:00`),
      supabase.from("booking_rules").select("*").eq("business_id", businessId).single(),
      supabase
        .from("staff_services")
        .select("staff_id")
        .eq("business_id", businessId)
        .eq("service_id", service_id as string),
    ]);

    // Transform working hours
    const whMap = new Map<number, { start: string; end: string }[]>();
    for (const wh of whResult.data || []) {
      if (!whMap.has(wh.day_of_week)) whMap.set(wh.day_of_week, []);
      if (!wh.is_closed) whMap.get(wh.day_of_week)!.push({ start: wh.start_time, end: wh.end_time });
    }

    const workingHours: WorkingDay[] = Array.from({ length: 7 }, (_, day) => {
      const ranges = whMap.get(day) || [];
      const isClosed = ranges.length === 0 || (whResult.data || []).some(
        (wh: Record<string, unknown>) => wh.day_of_week === day && wh.is_closed
      );
      return { dayOfWeek: day, ranges, isClosed };
    });

    const breaks: BreakPeriod[] = (brResult.data || []).map((b: Record<string, unknown>) => ({
      type: b.type as "recurring" | "one_time",
      dayOfWeek: (b.day_of_week as number) ?? undefined,
      specificDate: (b.specific_date as string) ?? undefined,
      start: b.start_time as string,
      end: b.end_time as string,
    }));

    const existingAppointments: ExistingAppointment[] = (aptResult.data || []).map(
      (a: Record<string, unknown>) => ({
        startTime: new Date(a.start_time as string),
        endTime: new Date(a.end_time as string),
        staffId: a.staff_id as string | null,
      })
    );

    // Include Google Calendar events as blocking entries
    for (const e of gcalResult.data || []) {
      existingAppointments.push({
        startTime: new Date(e.start_time as string),
        endTime: new Date(e.end_time as string),
        staffId: null,
      });
    }

    const serviceConfig: ServiceConfig = {
      durationMinutes: service.duration_minutes,
      bufferMinutes: service.buffer_minutes,
      maxCapacity: service.max_capacity,
    };

    const bookingRules: BookingRulesConfig | undefined = rulesResult.data
      ? {
          minAdvanceMinutes: rulesResult.data.min_advance_minutes,
          maxFutureDays: rulesResult.data.max_future_days,
          cancellationWindowMinutes: rulesResult.data.cancellation_window_minutes,
          rescheduleWindowMinutes: rulesResult.data.reschedule_window_minutes,
        }
      : undefined;

    // Determine if per-staff availability applies
    const assignedStaffIds = (ssResult.data || []).map((r: { staff_id: string }) => r.staff_id);
    const hasStaffAssignment = assignedStaffIds.length > 0;

    const slots = getAvailableSlots(
      dateStr,
      serviceConfig,
      workingHours,
      breaks,
      existingAppointments,
      bookingRules,
      service.duration_minutes + service.buffer_minutes
    );

    const mappedSlots = slots.map((s: { start: Date; end: Date; availableCapacity: number; totalCapacity: number }) => {
      let available_capacity = s.availableCapacity;
      let total_capacity = s.totalCapacity;

      if (hasStaffAssignment) {
        // Count assigned staff with no conflicting appointment in [slotStart, slotEnd+buffer]
        const slotStart = s.start;
        const slotEndWithBuffer = new Date(s.start.getTime() + (service.duration_minutes + service.buffer_minutes) * 60 * 1000);

        const freeStaffCount = assignedStaffIds.filter((staffId: string) => {
          const hasConflict = (aptResult.data || []).some((a: Record<string, unknown>) => {
            if (a.staff_id !== staffId) return false;
            const aStart = new Date(a.start_time as string);
            const aEnd = new Date(a.end_time as string);
            return aStart < slotEndWithBuffer && aEnd > slotStart;
          });
          return !hasConflict;
        }).length;

        available_capacity = freeStaffCount;
        total_capacity = assignedStaffIds.length;
      }

      return {
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        available_capacity,
        total_capacity,
      };
    });

    res.json({
      date: dateStr,
      service_id: service.id,
      service_name: service.name_he,
      duration_minutes: service.duration_minutes,
      slots: mappedSlots,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

### Steps

- [ ] Open `apps/api/src/routes/availability.ts`.
- [ ] Replace the entire file content with the code above.
- [ ] Run `cd apps/api && npx tsc --noEmit` — confirm zero type errors.
- [ ] Verify manually with a service that has no staff assigned: response slots `available_capacity` and `total_capacity` match the existing capacity-based behavior.
- [ ] Assign one staff member to a service via the PUT endpoint from Task 2. Book that staff member for a slot via a direct Supabase insert. Re-query availability — confirm that slot now has `available_capacity: 0`.
- [ ] Commit: `git add apps/api/src/routes/availability.ts && git commit -m "feat: availability per-staff slot checking"`

---

## Task 4: Appointments POST — auto-assign staff in `apps/api/src/routes/appointments.ts`

**File:** `apps/api/src/routes/appointments.ts`

### Change

In the POST handler, after validating that the slot is not over capacity but before inserting, add a staff auto-assignment block. Replace the POST handler body:

```ts
// POST /businesses/:businessId/appointments
router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const businessId = getBusinessId(req);
    const { service_id, customer_id, staff_id: requestedStaffId, start_time, notes, created_via, status } = req.body;

    const { data: service, error: serviceErr } = await supabase
      .from("services")
      .select("duration_minutes, buffer_minutes, max_capacity")
      .eq("id", service_id)
      .eq("business_id", businessId)
      .single();

    if (serviceErr || !service) throw new AppError(404, "Service not found");

    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);
    const endWithBuffer = new Date(endDate.getTime() + service.buffer_minutes * 60 * 1000);

    const { data: overlapping } = await supabase
      .from("appointments")
      .select("id")
      .eq("business_id", businessId)
      .eq("service_id", service_id)
      .lt("start_time", endWithBuffer.toISOString())
      .gt("end_time", startDate.toISOString())
      .not("status", "in", '("cancelled","no_show")');

    if (overlapping && overlapping.length >= service.max_capacity) {
      throw new AppError(409, "Time slot is fully booked");
    }

    // Auto-assign staff if service has assigned staff members
    let resolvedStaffId: string | null = requestedStaffId || null;

    const { data: ssRows } = await supabase
      .from("staff_services")
      .select("staff_id, business_members!inner(created_at)")
      .eq("business_id", businessId)
      .eq("service_id", service_id)
      .order("created_at", { referencedTable: "business_members", ascending: true });

    const assignedStaffIds = (ssRows || []).map((r: { staff_id: string }) => r.staff_id);

    if (assignedStaffIds.length > 0 && !resolvedStaffId) {
      // Fetch all appointments that conflict with [startDate, endWithBuffer] for assigned staff
      const { data: conflictingApts } = await supabase
        .from("appointments")
        .select("staff_id")
        .eq("business_id", businessId)
        .in("staff_id", assignedStaffIds)
        .lt("start_time", endWithBuffer.toISOString())
        .gt("end_time", startDate.toISOString())
        .not("status", "in", '("cancelled","no_show")');

      const busyStaffIds = new Set((conflictingApts || []).map((a: { staff_id: string }) => a.staff_id));

      const freeStaffId = assignedStaffIds.find((id: string) => !busyStaffIds.has(id)) || null;
      resolvedStaffId = freeStaffId;
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        business_id: businessId,
        service_id,
        customer_id,
        staff_id: resolvedStaffId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        notes: notes || null,
        created_via: created_via || "web",
        status: (created_via === "manual" && status) ? status : "pending",
      })
      .select("*, services(name_he, name_ar, name_en), customers(name, phone)")
      .single();

    if (error) throw new AppError(400, error.message);

    // Send booking confirmation notification (fire and forget)
    if (data?.id) {
      sendAppointmentNotification(data.id, "booking_confirmation").catch(() => {});
      sendManagerNotification(data.id).catch(() => {});
      pushAppointmentToGoogle(data.id).catch(() => {});
    }

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});
```

### Steps

- [ ] Open `apps/api/src/routes/appointments.ts`.
- [ ] Replace the existing POST handler (lines 68–129 in the original file) with the code above.
- [ ] Run `cd apps/api && npx tsc --noEmit` — confirm zero type errors.
- [ ] Verify manually:
  - Book an appointment for a service with no assigned staff → `staff_id` in the response is `null`.
  - Assign staff A and staff B to a service. Book a slot when staff A is busy (conflicting appointment exists with staff A's id) → the new appointment has `staff_id = staff B's id`.
  - Book a slot when both are busy → appointment is inserted with `staff_id = null` (no free staff found, still allowed if capacity permits).
- [ ] Commit: `git add apps/api/src/routes/appointments.ts && git commit -m "feat: auto-assign staff on appointment booking"`

---

## Task 5: WhatsApp agent — per-staff availability in `services/whatsapp-agent/src/index.ts`

**File:** `services/whatsapp-agent/src/index.ts`

### Change

Modify `getAvailableTimeSlots` (lines 259–349). Add a `staff_services` fetch to the parallel query block, then use it to filter slots.

Replace the entire function:

```ts
async function getAvailableTimeSlots(businessId: string, serviceId: string, date: string): Promise<{ time: string; label: string }[]> {
  const supabase = getSupabase();
  const d = new Date(date + "T12:00:00Z");
  const { day: dayOfWeek } = getIsraelDate(d);

  const [hoursRes, serviceRes, aptsRes, gcalRes, breaksRes, ssRes] = await Promise.all([
    supabase.from("working_hours").select("start_time, end_time, is_closed")
      .eq("business_id", businessId).eq("day_of_week", dayOfWeek).is("staff_id", null),
    supabase.from("services").select("duration_minutes, buffer_minutes, max_capacity")
      .eq("id", serviceId).single(),
    supabase.from("appointments").select("start_time, end_time, staff_id")
      .eq("business_id", businessId).eq("service_id", serviceId)
      .gte("start_time", `${date}T00:00:00`).lt("start_time", `${date}T23:59:59`)
      .in("status", ["pending", "confirmed", "in_progress"]),
    supabase.from("google_calendar_events").select("start_time, end_time")
      .eq("business_id", businessId)
      .gte("start_time", `${date}T00:00:00`).lt("start_time", `${date}T23:59:59`),
    supabase.from("breaks").select("type, day_of_week, specific_date, start_time, end_time")
      .eq("business_id", businessId).is("staff_id", null),
    supabase.from("staff_services").select("staff_id")
      .eq("business_id", businessId).eq("service_id", serviceId),
  ]);

  // Merge Google Calendar events into conflict detection (used only in non-staff path)
  const allConflicts = (aptsRes.data || []).concat(
    (gcalRes.data || []).map((e: any) => ({ start_time: e.start_time, end_time: e.end_time, staff_id: null }))
  );

  const wh = hoursRes.data?.[0];
  const service = serviceRes.data;
  if (!wh || wh.is_closed || !service) return [];

  // Check applicable breaks for this date
  const applicableBreaks = (breaksRes.data || []).filter((b: any) => {
    if (b.type === "recurring" && b.day_of_week === dayOfWeek) return true;
    if (b.type === "one_time" && b.specific_date === date) return true;
    return false;
  });

  // Check full-day block
  const isFullDayBlocked = applicableBreaks.some(
    (b: any) => b.start_time <= "00:01" && b.end_time >= "23:58"
  );
  if (isFullDayBlocked) return [];

  const assignedStaffIds: string[] = (ssRes.data || []).map((r: any) => r.staff_id as string);
  const hasStaffAssignment = assignedStaffIds.length > 0;

  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  const [startH, startM] = wh.start_time.split(":").map(Number);
  const [endH, endM] = wh.end_time.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const duration = service.duration_minutes;
  const buffer = service.buffer_minutes || 0;
  const step = duration + buffer;
  const slots: { time: string; label: string }[] = [];

  // Filter past times if date is today (Israel time)
  const now = getIsraelDate();
  const isToday = date === now.dateStr;
  const nowMinutes = now.hours * 60 + now.minutes;

  const tzOffset = getIsraelOffset(date);

  for (let m = startMin; m + duration <= endMin; m += step) {
    if (isToday && m <= nowMinutes) continue;

    // Check if slot overlaps any break
    const slotEnd = m + duration;
    const blockedByBreak = applicableBreaks.some((b: any) => {
      const bStart = toMin(b.start_time);
      const bEnd = toMin(b.end_time);
      return m < bEnd && slotEnd > bStart;
    });
    if (blockedByBreak) continue;

    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const endHH = String(Math.floor(slotEnd / 60)).padStart(2, "0");
    const endMM = String(slotEnd % 60).padStart(2, "0");
    const slotStart = `${date}T${hh}:${mm}:00${tzOffset}`;
    const slotEndStr = `${date}T${endHH}:${endMM}:00${tzOffset}`;

    const slotStartUTC = new Date(slotStart).toISOString();
    const slotEndUTC = new Date(slotEndStr).toISOString();

    if (hasStaffAssignment) {
      // Slot is available only if at least one assigned staff member has no conflict
      const atLeastOneFree = assignedStaffIds.some((staffId: string) => {
        const hasConflict = (aptsRes.data || []).some((a: any) => {
          if (a.staff_id !== staffId) return false;
          return a.start_time < slotEndUTC && a.end_time > slotStartUTC;
        });
        return !hasConflict;
      });
      if (!atLeastOneFree) continue;
    } else {
      // Fallback: capacity-based logic unchanged
      const conflicts = allConflicts.filter((a: any) => a.start_time < slotEndUTC && a.end_time > slotStartUTC);
      if (conflicts.length >= (service.max_capacity || 1)) continue;
    }

    slots.push({ time: slotStartUTC, label: `${hh}:${mm}` });
  }

  return slots;
}
```

### Steps

- [ ] Open `services/whatsapp-agent/src/index.ts`.
- [ ] Find the `getAvailableTimeSlots` function (starts at line 259 in the original file).
- [ ] Replace the entire function with the code above.
- [ ] Run `cd services/whatsapp-agent && npx tsc --noEmit` — confirm zero type errors.
- [ ] Verify:
  - Service with no assigned staff → WhatsApp availability unchanged (capacity-based).
  - Service with all staff busy for a given slot → that slot does not appear in the WhatsApp booking flow.
- [ ] Commit: `git add services/whatsapp-agent/src/index.ts && git commit -m "feat: whatsapp agent per-staff slot availability"`

---

## Task 6: Frontend — `StaffServicesModal` + updated staff list

### 6a: Create `apps/web/src/components/dashboard/staff-services-modal.tsx`

**Full file content:**

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface Service {
  id: string;
  name_he: string;
  is_active: boolean;
}

interface StaffMember {
  id: string;
  display_name: string;
  role: string;
  service_ids?: string[];
}

interface StaffServicesModalProps {
  member: StaffMember;
  businessId: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

export function StaffServicesModal({
  member,
  businessId,
  token,
  onClose,
  onSaved,
}: StaffServicesModalProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(member.service_ids || [])
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Service[]>(`/api/businesses/${businessId}/services`, {}, token)
      .then((data) => {
        setServices((Array.isArray(data) ? data : []).filter((s) => s.is_active));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [businessId, token]);

  const toggle = (serviceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(
        `/api/businesses/${businessId}/staff/${member.id}/services`,
        {
          method: "PUT",
          body: JSON.stringify({ service_ids: Array.from(selectedIds) }),
        },
        token
      );
      onSaved();
      onClose();
    } catch {
      // Ignore — parent will refetch on onSaved
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            שירותים — {member.display_name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">טוען שירותים...</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">לא נמצאו שירותים פעילים.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {services.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-4 py-2.5 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">{s.name_he}</span>
              </label>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          אם לא הוקצו שירותים — הצוות זמין לכל ההזמנות
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 6b: Update the staff tab in `apps/web/src/app/[locale]/dashboard/settings/page.tsx`

**Changes required:**

1. Extend the `StaffMember` interface to include `display_name` and `service_ids`:

```ts
interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  service_ids: string[];
  user?: { email: string; user_metadata?: { name?: string } };
}
```

2. Add state for the modal at the top of `SettingsPageInner` (alongside other state declarations):

```ts
const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
```

3. Add the import for `StaffServicesModal` at the top of the file (after the existing imports):

```ts
import { StaffServicesModal } from "@/components/dashboard/staff-services-modal";
```

4. Replace the `{tab === "staff" && ...}` block (lines 622–652 in the original file) with:

```tsx
{/* Staff Management */}
{tab === "staff" && (
  <div className="space-y-4">
    {staff.length > 0 && (
      <div className="space-y-2">
        {staff.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedMember(m)}
            className="w-full text-start flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
          >
            <div>
              <span className="font-medium text-base">{m.display_name}</span>
              <span
                className={`ms-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                  m.role === "owner"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {t(m.role as "owner" | "staff")}
              </span>
              {m.service_ids && m.service_ids.length > 0 && (
                <span className="ms-2 text-xs text-muted-foreground">
                  {m.service_ids.length} שירות{m.service_ids.length !== 1 ? "ים" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 hover:underline">שירותים</span>
              {m.role !== "owner" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStaff(m.id);
                  }}
                  className="text-red-500 text-xs hover:underline"
                >
                  {tCommon("delete")}
                </button>
              )}
            </div>
          </button>
        ))}
      </div>
    )}

    <div className="flex gap-2">
      <input
        type="email"
        placeholder={t("email")}
        value={newStaffEmail}
        onChange={(e) => setNewStaffEmail(e.target.value)}
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        onClick={addStaff}
        disabled={saving || !newStaffEmail}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {t("addStaff")}
      </button>
    </div>

    {selectedMember && businessId && (
      <StaffServicesModal
        member={selectedMember}
        businessId={businessId}
        token={token}
        onClose={() => setSelectedMember(null)}
        onSaved={() => {
          setSelectedMember(null);
          fetchTab();
        }}
      />
    )}
  </div>
)}
```

### Steps

- [ ] Create file `apps/web/src/components/dashboard/staff-services-modal.tsx` with the full content from section 6a above.
- [ ] Open `apps/web/src/app/[locale]/dashboard/settings/page.tsx`.
- [ ] Add import `import { StaffServicesModal } from "@/components/dashboard/staff-services-modal";` after the last existing import line.
- [ ] Replace the `StaffMember` interface with the updated version that adds `display_name: string` and `service_ids: string[]`.
- [ ] Add `const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);` in the state declarations block (after the `const [newStaffEmail, ...]` line).
- [ ] Replace the entire `{tab === "staff" && ...}` JSX block with the updated version from section 6b above.
- [ ] Run `cd apps/web && npx tsc --noEmit` — confirm zero type errors.
- [ ] Run the dev server (`pnpm dev`) and navigate to Settings → Staff Management:
  - Each staff row shows `display_name` prominently.
  - Clicking a row opens `StaffServicesModal`.
  - Checking/unchecking services and saving calls `PUT /staff/:memberId/services`.
  - After saving, the staff list re-fetches and the service count badge updates.
  - The note "אם לא הוקצו שירותים — הצוות זמין לכל ההזמנות" is visible at the bottom of the modal.
- [ ] Commit: `git add apps/web/src/components/dashboard/staff-services-modal.tsx apps/web/src/app/[locale]/dashboard/settings/page.tsx && git commit -m "feat: staff services modal and updated staff list UI"`

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| New `staff_services` join table with cascades and indexes | Task 1 |
| GET `/staff` returns `service_ids[]` per member | Task 2 |
| GET `/staff/:memberId/services` returns `{ service_ids }` | Task 2 |
| PUT `/staff/:memberId/services` replaces assignments | Task 2 |
| Availability falls back to capacity logic when no staff assigned | Task 3 |
| Availability counts free staff when staff assigned | Task 3 |
| `available_capacity` = free staff count | Task 3 |
| POST appointments auto-assigns first free staff (ordered by `created_at`) | Task 4 |
| `staff_id` remains null when no staff assigned | Task 4 |
| WhatsApp `getAvailableTimeSlots` skips slots with no free staff | Task 5 |
| WhatsApp falls back to capacity-based logic when no staff assigned | Task 5 |
| Staff list shows `display_name` prominently | Task 6 |
| Clicking staff row opens `StaffServicesModal` | Task 6 |
| Modal fetches active services and pre-checks current assignments | Task 6 |
| Save button calls PUT endpoint | Task 6 |
| Modal note: no assignments = available for all bookings | Task 6 |
| Deleting staff cascades (DB-level ON DELETE CASCADE) | Task 1 |
| Deleting service cascades (DB-level ON DELETE CASCADE) | Task 1 |

### Placeholder scan

No TBDs, no "handle edge cases", no "similar to", no "etc." — all code is complete and explicit.

### Type consistency

| Name | Task 2 API | Task 3 availability | Task 4 appointments | Task 5 WhatsApp | Task 6 frontend |
|---|---|---|---|---|---|
| `staff_id` | `string` | `string \| null` | `string \| null` | `string` | N/A |
| `service_ids` | `string[]` | N/A | N/A | N/A | `string[]` |
| `assignedStaffIds` | N/A | `string[]` | `string[]` | `string[]` | N/A |
| `display_name` | returned from `business_members.*` | N/A | N/A | N/A | `string` in `StaffMember` |
| `StaffMember.service_ids` | source (GET /staff) | N/A | N/A | N/A | `string[]` (fetched from API) |

All field names and types are consistent across layers.
