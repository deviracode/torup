# GCal Convert Appointment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow managers to click a Google Calendar event block in the daily/weekly calendar and convert it into a confirmed appointment.

**Architecture:** New `GCalConvertModal` component (modeled on `NewAppointmentForm`) is triggered by clicking GCal blocks in both calendars. Pre-fills start_time from the event, collects service + customer + notes, posts to existing `POST /appointments` with `status: "confirmed"`. No backend changes needed.

**Tech Stack:** React, Next.js App Router, `apiFetch`, existing appointments + customers + services API endpoints.

---

## File Structure

- **Create:** `apps/web/src/components/dashboard/gcal-convert-modal.tsx` — standalone modal component
- **Modify:** `apps/web/src/components/dashboard/daily-calendar.tsx` — make GCal blocks clickable, add modal state
- **Modify:** `apps/web/src/components/dashboard/weekly-calendar.tsx` — same wiring

---

### Task 1: Create `GCalConvertModal` component

**Files:**
- Create: `apps/web/src/components/dashboard/gcal-convert-modal.tsx`

- [ ] **Step 1: Create the file with the complete component**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

interface Service {
  id: string;
  name_he: string;
  duration_minutes: number;
  price: number;
  price_type: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface GCalEvent {
  google_event_id: string;
  summary: string;
  start_time: string;
  end_time: string;
}

export function GCalConvertModal({
  event,
  businessId,
  token,
  onClose,
  onCreated,
}: {
  event: GCalEvent;
  businessId: string;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ services: Service[] }>(
      `/api/businesses/${businessId}/services`,
      {},
      token
    )
      .then((r) => setServices(r.services || []))
      .catch(() => {});
  }, [businessId, token]);

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return; }
    const timeout = setTimeout(() => {
      apiFetch<{ customers: Customer[] }>(
        `/api/businesses/${businessId}/customers?search=${encodeURIComponent(customerSearch)}`,
        {},
        token
      )
        .then((r) => setCustomers(r.customers || []))
        .catch(() => setCustomers([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch, businessId, token]);

  const startLabel = new Date(event.start_time).toLocaleString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let customerId = selectedCustomer?.id;

      if (!customerId) {
        const c = await apiFetch<{ id: string }>(
          `/api/businesses/${businessId}/customers`,
          {
            method: "POST",
            body: JSON.stringify({ phone: newPhone, name: newName, language_preference: "he" }),
          },
          token
        );
        customerId = c.id;
      }

      await apiFetch(
        `/api/businesses/${businessId}/appointments`,
        {
          method: "POST",
          body: JSON.stringify({
            service_id: selectedServiceId,
            customer_id: customerId,
            start_time: event.start_time,
            notes: notes || null,
            created_via: "manual",
            status: "confirmed",
          }),
        },
        token
      );

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת התור");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">📅 {event.summary || "Google Calendar"}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{startLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {/* Service */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("selectService")}</label>
            <select
              required
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_he} ({s.duration_minutes} {t("min")}
                  {s.price_type === "discuss" ? " • לשיחה עם בעל העסק" : ` • ₪${s.price}`})
                </option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("selectCustomer")}</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
                <span>{selectedCustomer.name} ({selectedCustomer.phone})</span>
                <button type="button" onClick={() => setSelectedCustomer(null)} className="text-blue-600 hover:underline text-xs">
                  {tCommon("edit")}
                </button>
              </div>
            ) : showNewCustomer ? (
              <div className="space-y-2">
                <input
                  type="text" required placeholder={t("customerName")} value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="tel" required placeholder={t("customerPhone")} value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  dir="ltr"
                />
                <button type="button" onClick={() => setShowNewCustomer(false)} className="text-xs text-blue-600 hover:underline">
                  {tCommon("back")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text" placeholder={t("searchCustomer")} value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {customers.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200">
                    {customers.map((c) => (
                      <button
                        key={c.id} type="button"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                        className="w-full px-3 py-2 text-start text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        {c.name} <span className="text-gray-400" dir="ltr">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setShowNewCustomer(true)} className="text-xs text-blue-600 hover:underline">
                  + {t("createNewCustomer")}
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !selectedServiceId || (!selectedCustomer && (!newName || !newPhone))}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "..." : t("bookAppointment")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50"
            >
              {tCommon("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/gcal-convert-modal.tsx
git commit -m "feat: add GCalConvertModal component"
```

---

### Task 2: Wire GCalConvertModal into daily calendar

**Files:**
- Modify: `apps/web/src/components/dashboard/daily-calendar.tsx`

The current GCal event block is a `<div>` (lines ~222-231). Add `selectedGcalEvent` state, make the div a `<button>`, and render the modal.

- [ ] **Step 1: Add import and state**

At the top of the file, add the import after the existing imports:
```tsx
import { GCalConvertModal } from "./gcal-convert-modal";
```

Inside `DailyCalendar`, after the `selectedAppointment` state line, add:
```tsx
const [selectedGcalEvent, setSelectedGcalEvent] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string } | null>(null);
```

- [ ] **Step 2: Make GCal event blocks clickable**

Replace the existing GCal event `<div>` block (the one with `key={evt.google_event_id}` and `className="...bg-gray-50 border-gray-400..."`) with a `<button>`:

```tsx
<button
  key={evt.google_event_id}
  onClick={() => setSelectedGcalEvent(evt)}
  className="w-full rounded-md border-s-4 px-3 py-1.5 text-start text-sm bg-gray-50 border-gray-400 text-gray-600 opacity-80 hover:opacity-100 hover:shadow-sm transition-opacity cursor-pointer"
>
  <div className="flex items-center justify-between gap-2">
    <span className="font-medium truncate">📅 {evt.summary || "Google Calendar"}</span>
    <span className="text-xs shrink-0">{startTime}</span>
  </div>
  <div className="text-xs opacity-75">לחץ להמיר לתור</div>
</button>
```

- [ ] **Step 3: Render modal at the bottom of the return**

After the existing `AppointmentModal` block (the `{selectedAppointment && ...}` block), add:

```tsx
{selectedGcalEvent && (
  <GCalConvertModal
    event={selectedGcalEvent}
    businessId={businessId}
    token={session?.access_token || ""}
    onClose={() => setSelectedGcalEvent(null)}
    onCreated={fetchAppointments}
  />
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/daily-calendar.tsx
git commit -m "feat: make GCal events clickable in daily calendar to convert to appointment"
```

---

### Task 3: Wire GCalConvertModal into weekly calendar

**Files:**
- Modify: `apps/web/src/components/dashboard/weekly-calendar.tsx`

Same pattern as Task 2.

- [ ] **Step 1: Add import and state**

Add the import after existing imports:
```tsx
import { GCalConvertModal } from "./gcal-convert-modal";
```

Inside `WeeklyCalendar`, after the `selectedAppointment` state line, add:
```tsx
const [selectedGcalEvent, setSelectedGcalEvent] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string } | null>(null);
```

- [ ] **Step 2: Make GCal event blocks clickable**

Replace the existing GCal event `<div>` block (the one with `key={evt.google_event_id}` and `className="...bg-gray-50 border-gray-400..."`) with a `<button>`:

```tsx
<button
  key={evt.google_event_id}
  onClick={() => setSelectedGcalEvent(evt)}
  className="w-full rounded border-s-2 px-1 py-0.5 text-xs truncate mb-0.5 bg-gray-50 border-gray-400 text-gray-600 hover:opacity-80 cursor-pointer text-start"
>
  📅 {time} {evt.summary || "Google Calendar"}
</button>
```

- [ ] **Step 3: Render modal at the bottom of the return**

After the existing `AppointmentModal` block, add:

```tsx
{selectedGcalEvent && (
  <GCalConvertModal
    event={selectedGcalEvent}
    businessId={businessId}
    token={session?.access_token || ""}
    onClose={() => setSelectedGcalEvent(null)}
    onCreated={fetchWeekAppointments}
  />
)}
```

- [ ] **Step 4: Commit and push**

```bash
git add apps/web/src/components/dashboard/weekly-calendar.tsx
git commit -m "feat: make GCal events clickable in weekly calendar to convert to appointment"
git push origin main
```
