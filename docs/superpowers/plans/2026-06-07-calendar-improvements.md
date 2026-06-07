# Calendar Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four calendar improvements: hide cancelled appointments, reschedule via drag+modal, fix multi-capacity booking display, and add smart date navigation.

**Architecture:** All changes are isolated — frontend filter (Task 1), new API endpoint + modal UI (Task 2), capacity indicator in time slots (Task 3), and date picker enhancement in calendar + form (Task 4). No shared state changes needed across tasks.

**Tech Stack:** React/Next.js, TypeScript, Express, Supabase, native HTML5 drag-and-drop, Tailwind CSS

---

## File Map

| File | Task | Change |
|------|------|--------|
| `apps/web/src/components/dashboard/daily-calendar.tsx` | 1, 2 | Filter cancelled; add drag-and-drop; add month picker |
| `apps/web/src/components/dashboard/weekly-calendar.tsx` | 1, 4 | Filter cancelled; add month picker |
| `apps/web/src/components/dashboard/appointment-modal.tsx` | 2 | Add Reschedule button + inline time picker |
| `apps/api/src/routes/appointments.ts` | 2 | Add `PATCH /:appointmentId/reschedule` endpoint |
| `apps/web/src/components/dashboard/new-appointment-form.tsx` | 3, 4 | Capacity indicator on slots; date shortcuts |

---

## Task 1: Hide cancelled and no-show appointments from calendar

**Files:**
- Modify: `apps/web/src/components/dashboard/daily-calendar.tsx`
- Modify: `apps/web/src/components/dashboard/weekly-calendar.tsx`

- [ ] **Step 1: Filter in daily-calendar.tsx**

In `daily-calendar.tsx`, find the line (around line 185):
```ts
const hourAppts = appointments.filter((a) => new Date(a.start_time).getHours() === hour);
```

Replace with:
```ts
const hourAppts = appointments
  .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
  .filter((a) => new Date(a.start_time).getHours() === hour);
```

Also update the appointment count in the day header (around line 168) — find:
```ts
{appointments.length} {t("appointmentsCount")}
```
Replace with:
```ts
{appointments.filter(a => a.status !== "cancelled" && a.status !== "no_show").length} {t("appointmentsCount")}
```

- [ ] **Step 2: Filter in weekly-calendar.tsx**

Find where `weekly-calendar.tsx` maps appointments per cell (grep for `apt.status` or `hourAppts`). Add the same filter before rendering appointment blocks:
```ts
.filter((a) => a.status !== "cancelled" && a.status !== "no_show")
```

- [ ] **Step 3: Type-check**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/dashboard/daily-calendar.tsx apps/web/src/components/dashboard/weekly-calendar.tsx
git commit -m "feat: hide cancelled and no-show appointments from calendar view"
```

---

## Task 2: Reschedule appointments — API endpoint + modal button + drag-and-drop

**Files:**
- Modify: `apps/api/src/routes/appointments.ts`
- Modify: `apps/web/src/components/dashboard/appointment-modal.tsx`
- Modify: `apps/web/src/components/dashboard/daily-calendar.tsx`

### 2a: Add reschedule API endpoint

- [ ] **Step 1: Add reschedule route in appointments.ts**

After the `PATCH /:appointmentId/status` route, add:

```ts
// PATCH /businesses/:businessId/appointments/:appointmentId/reschedule
router.patch(
  "/:appointmentId/reschedule",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const appointmentId = getParam(req, "appointmentId");
      const { start_time } = req.body;

      if (!start_time) throw new AppError(400, "start_time is required");

      const { data: apt } = await supabase
        .from("appointments")
        .select("id, status, service_id, services(duration_minutes, buffer_minutes, max_capacity)")
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .single();

      if (!apt) throw new AppError(404, "Appointment not found");
      if (["completed", "cancelled", "no_show"].includes(apt.status)) {
        throw new AppError(400, "Cannot reschedule an appointment with status: " + apt.status);
      }

      const svc = (apt as any).services;
      const startDate = new Date(start_time);
      const endDate = new Date(startDate.getTime() + svc.duration_minutes * 60 * 1000);
      const endWithBuffer = new Date(endDate.getTime() + svc.buffer_minutes * 60 * 1000);

      const { data: overlapping } = await supabase
        .from("appointments")
        .select("id")
        .eq("business_id", businessId)
        .eq("service_id", apt.service_id)
        .neq("id", appointmentId)
        .lt("start_time", endWithBuffer.toISOString())
        .gt("end_time", startDate.toISOString())
        .not("status", "in", '("cancelled","no_show")');

      if (overlapping && overlapping.length >= svc.max_capacity) {
        throw new AppError(409, "Time slot is fully booked");
      }

      const { data, error } = await supabase
        .from("appointments")
        .update({ start_time: startDate.toISOString(), end_time: endDate.toISOString() })
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .select("*, services(name_he), customers(name, phone)")
        .single();

      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);
```

- [ ] **Step 2: Type-check API**
```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit API**
```bash
git add apps/api/src/routes/appointments.ts
git commit -m "feat: add PATCH /appointments/:id/reschedule endpoint"
```

### 2b: Add Reschedule button + inline picker to appointment modal

- [ ] **Step 4: Add reschedule state to appointment-modal.tsx**

At the top of `AppointmentModal`, find the existing state declarations and add:

```ts
const [showReschedule, setShowReschedule] = useState(false);
const [rescheduleDate, setRescheduleDate] = useState("");
const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string; end: string; available_capacity: number; total_capacity: number }[]>([]);
const [rescheduleSlot, setRescheduleSlot] = useState("");
const [rescheduling, setRescheduling] = useState(false);
```

- [ ] **Step 5: Add slot-fetch effect**

After the existing `useEffect` that fetches reminder logs, add:

```ts
useEffect(() => {
  if (!showReschedule || !rescheduleDate) return;
  apiFetch<{ slots: { start: string; end: string; available_capacity: number; total_capacity: number }[] }>(
    `/api/businesses/${businessId}/availability?service_id=${appointment.service_id}&date=${rescheduleDate}`,
    {},
    token
  )
    .then((r) => setRescheduleSlots(r.slots || []))
    .catch(() => setRescheduleSlots([]));
}, [showReschedule, rescheduleDate, businessId, appointment.service_id, token]);
```

- [ ] **Step 6: Add handleReschedule function**

After `handleStatusChange`, add:

```ts
const handleReschedule = async () => {
  if (!rescheduleSlot) return;
  setRescheduling(true);
  setError("");
  try {
    await apiFetch(
      `/api/businesses/${businessId}/appointments/${appointment.id}/reschedule`,
      { method: "PATCH", body: JSON.stringify({ start_time: rescheduleSlot }) },
      token
    );
    onUpdate();
    onClose();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to reschedule");
  } finally {
    setRescheduling(false);
  }
};
```

- [ ] **Step 7: Add Reschedule UI in the modal JSX**

Find the section that renders the `changeStatus` buttons (around the `{nextStatuses.length > 0 && ...}` block). After that section and before `<DialogFooter>`, add:

```tsx
{/* Reschedule — available for pending_approval, pending, confirmed */}
{["pending_approval", "pending", "confirmed"].includes(appointment.status) && (
  <div>
    <Button
      variant="outline"
      size="sm"
      onClick={() => { setShowReschedule(!showReschedule); setRescheduleDate(""); setRescheduleSlots([]); setRescheduleSlot(""); }}
    >
      🗓 {t("reschedule") || "Reschedule"}
    </Button>
    {showReschedule && (
      <div className="mt-3 space-y-3 rounded-lg border border-border p-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t("selectDate")}</label>
          <input
            type="date"
            min={new Date().toISOString().split("T")[0]}
            value={rescheduleDate}
            onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleSlot(""); }}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        {rescheduleSlots.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("selectTime")}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {rescheduleSlots.map((slot) => {
                const time = new Date(slot.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                const partial = slot.available_capacity < slot.total_capacity;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => setRescheduleSlot(slot.start)}
                    className={`rounded border px-2 py-1.5 text-xs transition-colors ${
                      rescheduleSlot === slot.start
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-foreground hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    {time}{partial ? ` (${slot.available_capacity}/${slot.total_capacity})` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {rescheduleDate && rescheduleSlots.length === 0 && (
          <p className="text-xs text-muted-foreground">אין שעות פנויות בתאריך זה</p>
        )}
        {rescheduleSlot && (
          <Button size="sm" onClick={handleReschedule} disabled={rescheduling}>
            {rescheduling ? "..." : t("bookAppointment") || "Confirm"}
          </Button>
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 8: Type-check**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors.

- [ ] **Step 9: Commit modal**
```bash
git add apps/web/src/components/dashboard/appointment-modal.tsx
git commit -m "feat: reschedule button + inline date/time picker in appointment modal"
```

### 2c: Add drag-and-drop to daily calendar

- [ ] **Step 10: Add drag state to daily-calendar.tsx**

At the top of the `DailyCalendar` component (after existing state), add:
```ts
const [draggingId, setDraggingId] = useState<string | null>(null);
const [dragOver, setDragOver] = useState<number | null>(null);
```

- [ ] **Step 11: Make appointment blocks draggable**

Find the appointment `<button>` block (around line 219). Replace:
```tsx
<button
  key={apt.id}
  onClick={() => setSelectedAppointment(apt)}
  className={`w-full rounded-lg border-s-[3px] px-3 py-1.5 text-start text-xs font-medium hover:brightness-110 transition-all ${sc}`}
>
```
With:
```tsx
<button
  key={apt.id}
  draggable={!["completed", "cancelled", "no_show"].includes(apt.status)}
  onDragStart={(e) => {
    e.dataTransfer.setData("appointmentId", apt.id);
    e.dataTransfer.setData("serviceDuration", String(apt.services?.duration_minutes || 30));
    setDraggingId(apt.id);
  }}
  onDragEnd={() => setDraggingId(null)}
  onClick={() => setSelectedAppointment(apt)}
  className={`w-full rounded-lg border-s-[3px] px-3 py-1.5 text-start text-xs font-medium hover:brightness-110 transition-all ${sc} ${draggingId === apt.id ? "opacity-50" : ""}`}
>
```

- [ ] **Step 12: Make hour rows drop targets**

Find the hour row `<motion.div>` (around line 190). Add drag event handlers to the inner content div (the `<div className="flex-1 min-h-[56px] ...">`):

```tsx
<div
  className={`flex-1 min-h-[56px] py-1.5 px-2 space-y-1 transition-colors ${dragOver === hour ? "bg-primary/10 rounded" : ""}`}
  onDragOver={(e) => { e.preventDefault(); setDragOver(hour); }}
  onDragLeave={() => setDragOver(null)}
  onDrop={async (e) => {
    e.preventDefault();
    setDragOver(null);
    const appointmentId = e.dataTransfer.getData("appointmentId");
    const duration = Number(e.dataTransfer.getData("serviceDuration"));
    if (!appointmentId || !session?.access_token) return;
    const newStart = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
    try {
      await apiFetch(
        `/api/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
        { method: "PATCH", body: JSON.stringify({ start_time: newStart.toISOString() }) },
        session.access_token
      );
      fetchAppointments();
    } catch (err) {
      console.error("Reschedule failed:", err);
    }
  }}
>
```

- [ ] **Step 13: Type-check**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors.

- [ ] **Step 14: Run full test suite**
```bash
cd /Users/adamazz1993/Desktop/torup && pnpm turbo test 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 15: Commit drag-and-drop**
```bash
git add apps/web/src/components/dashboard/daily-calendar.tsx
git commit -m "feat: drag-and-drop reschedule on daily calendar"
```

---

## Task 3: Capacity indicator on time slots in new-appointment-form

**Files:**
- Modify: `apps/web/src/components/dashboard/new-appointment-form.tsx`

The availability API already returns `available_capacity` in each slot. The `TimeSlot` interface already has `available_capacity`. We need to add `total_capacity` to the interface and show `(1/2)` on partially-filled slots.

- [ ] **Step 1: Add total_capacity to TimeSlot interface**

Find:
```ts
interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
}
```
Replace with:
```ts
interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
  total_capacity: number;
}
```

- [ ] **Step 2: Show capacity indicator on slot buttons**

Find the slot button render (around line 204):
```tsx
{time}
```
Replace with:
```tsx
{time}{slot.total_capacity > 1 && slot.available_capacity < slot.total_capacity ? ` (${slot.available_capacity}/${slot.total_capacity})` : ""}
```

- [ ] **Step 3: Type-check**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -5
```
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/dashboard/new-appointment-form.tsx
git commit -m "feat: show capacity indicator on time slots (e.g. 14:00 (1/2))"
```

---

## Task 4: Smart date navigation — month picker popup + quick date shortcuts

**Files:**
- Modify: `apps/web/src/components/dashboard/daily-calendar.tsx`
- Modify: `apps/web/src/components/dashboard/weekly-calendar.tsx`
- Modify: `apps/web/src/components/dashboard/new-appointment-form.tsx`

### 4a: Month/year popup on daily calendar

- [ ] **Step 1: Add month picker state to daily-calendar.tsx**

After existing state declarations, add:
```ts
const [showMonthPicker, setShowMonthPicker] = useState(false);
const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
```

- [ ] **Step 2: Make date label clickable and add popup**

Find the date label section (around line 139-154). Replace the `<div className="text-center">` block with:

```tsx
<div className="text-center relative">
  <button
    className="text-sm font-semibold text-white hover:text-[#a78bfa] transition-colors"
    onClick={() => {
      setPickerYear(new Date(date + "T12:00:00").getFullYear());
      setShowMonthPicker(!showMonthPicker);
    }}
  >
    {dayLabel}
  </button>
  <button
    onClick={() => setDate(formatDate(new Date()))}
    disabled={isToday}
    className={`text-xs transition-colors mt-0.5 block ${isToday ? "text-white/25 cursor-default" : "text-[#a78bfa] hover:text-white"}`}
  >
    {t("today")}
  </button>
  {showMonthPicker && (
    <div
      className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-white/10 bg-[hsl(242_44%_10%)] shadow-2xl p-3 w-56"
      onMouseLeave={() => setShowMonthPicker(false)}
    >
      {/* Year selector */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setPickerYear((y) => y - 1)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
        >
          ›
        </button>
        <span className="text-sm font-semibold text-white">{pickerYear}</span>
        <button
          onClick={() => setPickerYear((y) => y + 1)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
        >
          ‹
        </button>
      </div>
      {/* Month grid */}
      <div className="grid grid-cols-3 gap-1">
        {["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"].map((m, i) => {
          const currentMonth = new Date(date + "T12:00:00").getMonth();
          const currentYear = new Date(date + "T12:00:00").getFullYear();
          const isCurrentMonth = i === currentMonth && pickerYear === currentYear;
          return (
            <button
              key={i}
              onClick={() => {
                const d = new Date(pickerYear, i, 1);
                setDate(formatDate(d));
                setShowMonthPicker(false);
              }}
              className={`rounded-lg py-1.5 text-xs transition-colors ${
                isCurrentMonth
                  ? "bg-primary/20 text-[#a78bfa] font-semibold"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 3: Type-check daily calendar**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Add same month picker to weekly-calendar.tsx**

Read `weekly-calendar.tsx` to find its date header. Add the same `showMonthPicker`/`pickerYear` state and the same popup component (the weekly calendar uses a different date format but same navigation pattern).

In the weekly calendar header, find where the week range is displayed (e.g. "1–7 יוני 2026"). Make it clickable and attach the same popup with the same structure, but on month selection jump to `setWeekStart` (or equivalent) for the 1st of that month.

- [ ] **Step 5: Type-check**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors.

- [ ] **Step 6: Commit calendar month pickers**
```bash
git add apps/web/src/components/dashboard/daily-calendar.tsx apps/web/src/components/dashboard/weekly-calendar.tsx
git commit -m "feat: month/year popup picker on calendar header"
```

### 4b: Quick date shortcuts in new-appointment-form

- [ ] **Step 7: Add shortcuts below the date input in new-appointment-form.tsx**

Find the date input section (around line 180-186):
```tsx
<input type="date" required min={today} max={maxDate} value={date}
  onChange={(e) => { setDate(e.target.value); setSelectedSlot(""); }}
  className={inputCls}
/>
```

After that `<input>`, add:
```tsx
<div className="flex gap-1.5 mt-1.5 flex-wrap">
  {[
    { label: "היום", getValue: () => today },
    { label: "מחר", getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; } },
    { label: "+שבוע", getValue: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; } },
    { label: "+חודש", getValue: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; } },
  ].map(({ label, getValue }) => {
    const val = getValue();
    const withinRange = val >= today && val <= maxDate;
    if (!withinRange) return null;
    return (
      <button
        key={label}
        type="button"
        onClick={() => { setDate(val); setSelectedSlot(""); }}
        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
          date === val
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
        }`}
      >
        {label}
      </button>
    );
  })}
</div>
```

- [ ] **Step 8: Type-check**
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -5
```
Expected: no errors.

- [ ] **Step 9: Run full test suite**
```bash
cd /Users/adamazz1993/Desktop/torup && pnpm turbo test 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 10: Commit shortcuts**
```bash
git add apps/web/src/components/dashboard/new-appointment-form.tsx
git commit -m "feat: quick date shortcuts (today/tomorrow/+week/+month) in new appointment form"
```

---

## Verification

1. **Cancelled filter:** Create a test appointment, cancel it — verify it disappears from the daily/weekly calendar.
2. **Modal reschedule:** Open any confirmed appointment → click "Reschedule" → pick a date+time → confirm — verify start/end time updated.
3. **Drag-and-drop:** On daily calendar, drag an appointment to a different hour row — verify time updated and calendar refreshes.
4. **Capacity:** Create a service with `max_capacity = 2`. Book slot 14:00. Open new appointment form → select same service + date → verify 14:00 shows as `14:00 (1/2)` not hidden.
5. **Month picker:** In daily calendar, click the date label — verify popup opens with year selector and month grid. Click October — verify calendar jumps to October 1.
6. **Date shortcuts:** In new appointment form, click "+חודש" — verify date field jumps 1 month forward.

---

## Self-Review

- **Spec coverage:** All 4 spec sections covered. Filter (Task 1) ✓, reschedule modal + drag + endpoint (Task 2) ✓, capacity indicator (Task 3) ✓, month picker + shortcuts (Task 4) ✓
- **No placeholders:** All code is complete and copy-pasteable
- **Type consistency:** `TimeSlot.total_capacity` added in Task 3 interface; used in Task 3 step 2 — consistent. `draggingId` state added in Task 2 step 10, used in step 11 — consistent.
- **Scope:** All changes are UI/API within the calendar + form. No schema migrations needed.
