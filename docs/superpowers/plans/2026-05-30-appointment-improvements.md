# Appointment Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 7 appointment system improvements: multiple bookings toggle, services without price, manager booking form, WhatsApp date input, time-of-day grouping, manager notifications, and Google Calendar two-way sync.

**Architecture:** Bottom-up per item. Each item touches DB → API/WhatsApp → Web in self-contained changes. Simple items (1-2) go first as quick wins; WhatsApp flow changes (4,7) build on them; manager booking (3) and notifications (5) are independent; Google Calendar sync (8) is the largest and goes last.

**Tech Stack:** Node.js/Express API, Next.js 15 (App Router) web, Supabase PostgreSQL, WhatsApp Cloud API, Google Calendar API v3, TypeScript throughout.

---

## File Structure

```
supabase/migrations/
  00012_multiple_bookings.sql              NEW — item 1
  00013_price_type.sql                     NEW — item 2
  00014_google_calendar.sql                NEW — item 8

services/whatsapp-agent/src/
  index.ts                                 MODIFY — items 1,2,4,7,5
  session.ts                               MODIFY — item 4

apps/api/src/
  index.ts                                 MODIFY — item 8 (mount routes)
  routes/services.ts                       MODIFY — item 2
  routes/appointments.ts                   MODIFY — item 5
  services/notifications.ts                MODIFY — items 5,8
  services/google-calendar.ts              NEW — item 8
  routes/google-calendar.ts                NEW — item 8

apps/web/src/
  components/dashboard/new-appointment-form.tsx  REWRITE — item 3
  components/booking/booking-flow.tsx            MODIFY — item 2
  app/[locale]/dashboard/page.tsx                MODIFY — item 5
  app/[locale]/dashboard/settings/page.tsx       MODIFY — items 1,8
  app/[locale]/dashboard/layout.tsx              MODIFY — item 5
  lib/api.ts                                     MODIFY — item 1

packages/api/package.json                        MODIFY — item 8 (add googleapis)
```

---

### Task 1: Migration — allow_multiple_bookings column

**Files:**
- Create: `supabase/migrations/00012_multiple_bookings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00012_multiple_bookings.sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS allow_multiple_bookings BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or `supabase db push` if CLI is globally installed)
Expected: Column added to businesses table

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00012_multiple_bookings.sql
git commit -m "feat: add allow_multiple_bookings toggle to businesses"
```

---

### Task 2: WhatsApp agent — respect allow_multiple_bookings toggle

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Modify getCachedBusinessContext to include the toggle**

In `getCachedBusinessContext`, update the `resolveBusinessId` query to also select `allow_multiple_bookings`:

In `resolveBusinessId` (line 90-93), change:
```ts
const { data } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (data) return { businessId: data.id, businessName: data.name };
```
To:
```ts
const { data } = await supabase
    .from("businesses")
    .select("id, name, allow_multiple_bookings")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (data) return { businessId: data.id, businessName: data.name, allowMultipleBookings: data.allow_multiple_bookings };
```

Update the return type from `{ businessId: string; businessName: string }` to `{ businessId: string; businessName: string; allowMultipleBookings: boolean }`.

- [ ] **Step 2: Update the bizCache type and getCachedBusinessContext**

In the `bizCache` declaration (line 118), update the type:
```ts
const bizCache = new Map<string, { biz: { businessId: string; businessName: string; allowMultipleBookings: boolean }; services: Record<string, any>[]; expiresAt: number }>();
```

- [ ] **Step 3: Modify createBooking to accept and check the toggle**

Add a parameter `allowMultipleBookings: boolean` to `createBooking`. Wrap the single-active-appointment check:

```ts
async function createBooking(
  businessId: string,
  serviceId: string,
  startTime: string,
  customerId: string,
  allowMultipleBookings: boolean
): Promise<"ok" | "already_booked" | string> {
  const supabase = getSupabase();

  const { data: service } = await supabase.from("services")
    .select("duration_minutes").eq("id", serviceId).single();
  if (!service) return "שגיאה: שירות לא נמצא";

  if (!allowMultipleBookings) {
    const { count: activeCount, error: countErr } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .in("status", ["pending_approval", "pending", "confirmed"])
      .gt("start_time", new Date().toISOString());
    if (countErr) return `שגיאה: ${countErr.message}`;
    if ((activeCount ?? 0) > 0) return "already_booked";
  }

  // ... rest stays the same
}
```

- [ ] **Step 4: Update the call site**

In `handleIncomingMessage`, at the `confirm_yes` handler (line ~612), pass the toggle:
```ts
const result = await createBooking(
  ctx.biz.businessId,
  session.booking.serviceId,
  session.booking.time,
  session.customerId,
  ctx.biz.allowMultipleBookings
);
```

- [ ] **Step 5: Verify type-check**

Run: `pnpm --filter @torup/whatsapp-agent type-check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: respect allow_multiple_bookings toggle in WhatsApp booking"
```

---

### Task 3: Settings UI — allow_multiple_bookings toggle

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/settings/page.tsx`

- [ ] **Step 1: Add allow_multiple_bookings to profile state and tab**

Add a new tab for "booking" settings. In the tabs array, add:
```ts
{ key: "booking", label: t("booking") },
```

Add to the type union:
```ts
type Tab = "hours" | "breaks" | "reminders" | "rules" | "staff" | "profile" | "booking";
```

Add state:
```ts
const [allowMultipleBookings, setAllowMultipleBookings] = useState(false);
```

- [ ] **Step 2: Fetch current value when tab = "booking"**

In the `fetchTab` callback, add:
```ts
} else if (tab === "booking") {
  const r = await apiFetch<{ allow_multiple_bookings: boolean }>(`/api/businesses/${businessId}`, {}, token);
  if (r) setAllowMultipleBookings(r.allow_multiple_bookings ?? false);
}
```

- [ ] **Step 3: Add save handler**

```ts
const saveBooking = async () => {
  setSaving(true);
  try {
    await apiFetch(`/api/businesses/${businessId}`, {
      method: "PATCH",
      body: JSON.stringify({ allow_multiple_bookings: allowMultipleBookings }),
    }, token);
    showSaved();
  } catch {} finally { setSaving(false); }
};
```

- [ ] **Step 4: Add the UI for the "booking" tab**

After the `{tab === "staff" &&` block, add:
```tsx
{tab === "booking" && (
  <div className="space-y-4 max-w-md">
    <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{t("allowMultipleBookings")}</p>
        <p className="text-xs text-muted-foreground">{t("allowMultipleBookingsDesc")}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={allowMultipleBookings}
          onChange={(e) => setAllowMultipleBookings(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
    <button onClick={saveBooking} disabled={saving}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
      {tCommon("save")}
    </button>
  </div>
)}
```

- [ ] **Step 5: Add translation keys**

The translation keys `booking`, `allowMultipleBookings`, `allowMultipleBookingsDesc` need to be added to the i18n files. Check `packages/i18n` for the messages JSON files and add the Hebrew/English/Arabic keys. If the i18n package uses a messages file at `packages/i18n/src/messages/`, add there.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/dashboard/settings/page.tsx packages/i18n/
git commit -m "feat: add allow_multiple_bookings toggle in settings UI"
```

---

### Task 4: Migration — price_type column

**Files:**
- Create: `supabase/migrations/00013_price_type.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00013_price_type.sql
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'fixed'
  CHECK (price_type IN ('fixed', 'discuss'));
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Column added

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00013_price_type.sql
git commit -m "feat: add price_type column to services"
```

---

### Task 5: WhatsApp agent — handle discuss-type services

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Include price_type in getBusinessServices**

In `getBusinessServices`, add `price_type` to the select:
```ts
.select("id, name_he, name_ar, name_en, duration_minutes, price, price_type")
```

- [ ] **Step 2: Show discuss message when discuss-type service selected**

In the service selection handler (`interactionId.startsWith("service_")`), add a check BEFORE the date selection flow. Find the service in `ctx.services` and check `price_type`:

```ts
if (interactionId.startsWith("service_")) {
  const serviceId = interactionId.replace("service_", "");
  const serviceName = text;
  
  // Check if this is a "discuss" service
  const service = ctx.services.find((s: any) => s.id === serviceId);
  if (service?.price_type === "discuss") {
    const bizPhone = ctx.biz.businessName; // use business phone
    await sendTextMessage(
      businessPhoneNumberId,
      from,
      `שירות זה דורש תיאום עם בעל העסק.\n📞 צרו קשר בוואטסאפ: https://wa.me/${from.replace(/[^0-9]/g, "")}`
    );
    await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName);
    return;
  }

  const dates = await findNextAvailableDates(ctx.biz.businessId, serviceId);
  // ... rest stays the same
}
```

Wait — the WhatsApp link should go TO the business, not to the customer themselves. Get the business phone from the `resolveBusinessId` function. Let's add the business phone to the biz cache.

In `resolveBusinessId`, add `phone` to the select:
```ts
.select("id, name, phone, allow_multiple_bookings")
```

Update the return to include `phone: data.phone`.

Then the discuss message WhatsApp link points to the business:
```ts
const bizWhatsApp = ctx.biz.phone.replace(/[^0-9]/g, "");
await sendTextMessage(
  businessPhoneNumberId,
  from,
  `שירות זה דורש תיאום עם בעל העסק.\n📞 צרו קשר בוואטסאפ: https://wa.me/${bizWhatsApp}`
);
```

- [ ] **Step 3: Show discuss label in sendServiceList**

When rendering service rows, show "לשיחה עם בעל העסק" instead of price for discuss-type:
```ts
const rows = services.map((s: any) => ({
  id: `service_${s.id || s.name_he}`,
  title: (s.name_he || "").slice(0, 24),
  description: s.price_type === "discuss"
    ? `${s.duration_minutes} דק׳ • לשיחה עם בעל העסק`
    : `${s.duration_minutes} דק׳ • ₪${s.price}`,
}));
```

- [ ] **Step 4: Verify type-check**

Run: `pnpm --filter @torup/whatsapp-agent type-check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: handle discuss-type services in WhatsApp flow"
```

---

### Task 6: Web booking flow — discuss-type services

**Files:**
- Modify: `apps/web/src/components/booking/booking-flow.tsx`

- [ ] **Step 1: Add price_type to Service interface**

```ts
interface Service {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  description_he: string | null;
  duration_minutes: number;
  price: number;
  price_type: string;  // add this
}
```

- [ ] **Step 2: Show discuss label and WhatsApp redirect**

In the service card rendering (the `step === "service"` block), change the price display:

```tsx
<span className="flex items-center gap-1">
  <Banknote className="h-3.5 w-3.5" />
  {service.price_type === "discuss" ? t("discussWithManager") : `₪${service.price}`}
</span>
```

And change the `handleServiceSelect` to redirect to WhatsApp for discuss services:

```ts
const handleServiceSelect = (service: Service) => {
  if (service.price_type === "discuss") {
    window.open(
      `https://wa.me/${business.phone.replace(/[^0-9]/g, "")}`,
      "_blank"
    );
    return;
  }
  setSelectedService(service);
  setStep("date");
};
```

- [ ] **Step 3: Add translation key**

Add `discussWithManager` key: `"לשיחה עם בעל העסק"` (he), `"Discuss with manager"` (en), `"للتحدث مع المدير"` (ar).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/booking/booking-flow.tsx packages/i18n/
git commit -m "feat: handle discuss-type services in web booking flow"
```

---

### Task 7: API — accept price_type in service endpoints

**Files:**
- Modify: `apps/api/src/routes/services.ts`

- [ ] **Step 1: Allow price_type in POST/PATCH body**

The existing POST and PATCH pass `req.body` directly to Supabase insert/update. Since the column now exists, it's automatically accepted. No code change needed — just verify.

- [ ] **Step 2: Verify**

Run: `pnpm --filter @torup/api type-check`
Expected: No errors

- [ ] **Step 3: Commit** (skip if no changes — note in previous commit message that API auto-accepts)

---

### Task 8: Rewrite new-appointment-form — Part 1 (core form)

**Files:**
- Rewrite: `apps/web/src/components/dashboard/new-appointment-form.tsx`

- [ ] **Step 1: Write the new component**

Full rewrite of `new-appointment-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
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

interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
}

const TIME_GROUPS: { label: string; range: [number, number] }[] = [
  { label: "☀️ בוקר", range: [6, 11] },
  { label: "🌤️ צהריים", range: [12, 15] },
  { label: "🌙 אחה\"צ/ערב", range: [16, 23] },
];

function groupSlots(slots: TimeSlot[]): Record<string, TimeSlot[]> {
  const grouped: Record<string, TimeSlot[]> = { morning: [], noon: [], evening: [] };
  for (const slot of slots) {
    const h = new Date(slot.start).getHours();
    if (h >= 6 && h < 12) grouped.morning.push(slot);
    else if (h >= 12 && h < 16) grouped.noon.push(slot);
    else grouped.evening.push(slot);
  }
  return grouped;
}

export function NewAppointmentForm({
  businessId,
  onClose,
  onCreated,
}: {
  businessId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { session } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"confirmed" | "pending_approval">("confirmed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maxFutureDays, setMaxFutureDays] = useState(14);

  const token = session?.access_token || "";

  useEffect(() => {
    apiFetch<Service[]>(`/api/businesses/${businessId}/services`, {}, token)
      .then((r) => setServices(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [businessId, token]);

  useEffect(() => {
    apiFetch<{ max_future_days?: number }>(
      `/api/businesses/${businessId}/booking-rules`, {}, token
    )
      .then((r) => { if (r.max_future_days) setMaxFutureDays(r.max_future_days); })
      .catch(() => {});
  }, [businessId, token]);

  useEffect(() => {
    if (!selectedServiceId || !date) return;
    apiFetch<{ slots: TimeSlot[] }>(
      `/api/businesses/${businessId}/availability?service_id=${selectedServiceId}&date=${date}`,
      {}, token
    )
      .then((r) => setSlots(r.slots || []))
      .catch(() => setSlots([]));
  }, [selectedServiceId, date, businessId, token]);

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return; }
    const timeout = setTimeout(() => {
      apiFetch<{ customers: Customer[] }>(
        `/api/businesses/${businessId}/customers?search=${encodeURIComponent(customerSearch)}`,
        {}, token
      )
        .then((r) => setCustomers(r.customers || []))
        .catch(() => setCustomers([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch, businessId, token]);

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
            start_time: selectedSlot,
            notes: notes || null,
            created_via: "manual",
            status,
          }),
        },
        token
      );

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  };

  // Compute date constraints
  const today = new Date().toISOString().split("T")[0];
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + maxFutureDays);
    return d.toISOString().split("T")[0];
  })();

  const grouped = groupSlots(slots);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold">{t("newAppointment")}</h3>
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
                  {s.price_type === "discuss" ? ` • ${t("discussWithManager")}` : ` • ₪${s.price}`})
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("selectDate")}</label>
            <input
              type="date"
              required
              min={today}
              max={maxDate}
              value={date}
              onChange={(e) => { setDate(e.target.value); setSelectedSlot(""); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Time Slots — grouped */}
          {selectedServiceId && date && (
            <div>
              <label className="block text-sm font-medium mb-1">{t("selectTime")}</label>
              {slots.length === 0 ? (
                <p className="text-sm text-gray-400">{t("noResults")}</p>
              ) : (
                <div className="space-y-3">
                  {grouped.morning.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">☀️ בוקר</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {grouped.morning.map((slot) => {
                          const time = new Date(slot.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                          return (
                            <button key={slot.start} type="button"
                              onClick={() => setSelectedSlot(slot.start)}
                              className={`rounded border px-2 py-1.5 text-sm ${selectedSlot === slot.start ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 hover:border-blue-300"}`}>
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {grouped.noon.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">🌤️ צהריים</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {grouped.noon.map((slot) => {
                          const time = new Date(slot.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                          return (
                            <button key={slot.start} type="button"
                              onClick={() => setSelectedSlot(slot.start)}
                              className={`rounded border px-2 py-1.5 text-sm ${selectedSlot === slot.start ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 hover:border-blue-300"}`}>
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {grouped.evening.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">🌙 אחה"צ/ערב</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {grouped.evening.map((slot) => {
                          const time = new Date(slot.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                          return (
                            <button key={slot.start} type="button"
                              onClick={() => setSelectedSlot(slot.start)}
                              className={`rounded border px-2 py-1.5 text-sm ${selectedSlot === slot.start ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 hover:border-blue-300"}`}>
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("status")}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "confirmed" | "pending_approval")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="confirmed">{t("confirmed")}</option>
              <option value="pending_approval">{t("pendingApproval")}</option>
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
                <input type="text" required placeholder={t("customerName")} value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                <input type="tel" required placeholder={t("customerPhone")} value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" dir="ltr" />
                <button type="button" onClick={() => setShowNewCustomer(false)} className="text-xs text-blue-600 hover:underline">
                  {tCommon("back")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" placeholder={t("searchCustomer")} value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                {customers.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200">
                    {customers.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                        className="w-full px-3 py-2 text-start text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
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
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="submit"
              disabled={loading || !selectedServiceId || !selectedSlot || (!selectedCustomer && (!newName || !newPhone))}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {t("bookAppointment")}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
              {tCommon("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add translation keys**

Add to i18n: `discussWithManager`, `confirmed`, `pendingApproval`, `status`, `morning`, `noon`, `evening`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/new-appointment-form.tsx packages/i18n/
git commit -m "feat: rewrite manager booking form with status selector and slot grouping"
```

---

### Task 9: API — accept status field in appointment creation

**Files:**
- Modify: `apps/api/src/routes/appointments.ts`

- [ ] **Step 1: Accept status from body when created_via is manual**

In the POST handler (~line 66), add `status` to destructured body and use it:

```ts
const { service_id, customer_id, staff_id, start_time, notes, created_via, status } = req.body;
```

Then in the insert, accept the status field but only for manual bookings:

```ts
const appointmentStatus = (created_via === "manual" && status) ? status : "pending";

const { data, error } = await supabase
  .from("appointments")
  .insert({
    business_id: businessId,
    service_id,
    customer_id,
    staff_id: staff_id || null,
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    notes: notes || null,
    created_via: created_via || "web",
    status: appointmentStatus,
  })
```

- [ ] **Step 2: Verify type-check**

Run: `pnpm --filter @torup/api type-check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/appointments.ts
git commit -m "feat: accept status field for manual appointment creation"
```

---

### Task 10: WhatsApp agent — date input flow (item 4)

**Files:**
- Modify: `services/whatsapp-agent/src/session.ts`
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Add bookingFlow to session state**

In `session.ts`, update `ConversationSession` interface to add:
```ts
bookingFlow?: "quick" | "specific";
```

And add to `createSession`, `updateSession` (already handled via `Object.assign`).

- [ ] **Step 2: After service selection, show quick/specific choice**

In the service selection handler (`interactionId.startsWith("service_")`), instead of immediately showing dates, show a choice:

```ts
if (interactionId.startsWith("service_")) {
  const serviceId = interactionId.replace("service_", "");
  const serviceName = text;
  
  const service = ctx.services.find((s: any) => s.id === serviceId);
  if (service?.price_type === "discuss") {
    // ... discuss handling from Task 5
    return;
  }

  updateSession(from, businessPhoneNumberId, {
    booking: { step: "select_date", serviceId, serviceName },
  });

  await sendButtonMessage(businessPhoneNumberId, from,
    `${serviceName} ✂️\nאיך תרצו לבחור תאריך?`,
    [
      { id: "flow_quick", title: "📅 התאריכים הקרובים" },
      { id: "flow_specific", title: "📆 תאריך אחר" },
    ]
  );
  return;
}
```

- [ ] **Step 3: Handle flow_quick — show 5 next dates**

Add handler:
```ts
if (interactionId === "flow_quick" && session.booking?.step === "select_date") {
  updateSession(from, businessPhoneNumberId, { bookingFlow: "quick" });
  const dates = await findNextAvailableDates(ctx.biz.businessId, session.booking.serviceId, 14);  // search 14 days, return up to 5
  
  if (dates.length === 0) {
    await sendTextMessage(businessPhoneNumberId, from, "אין תאריכים פנויים בשבועיים הקרובים 😔");
    return;
  }

  await sendButtonMessage(businessPhoneNumberId, from,
    `${session.booking.serviceName} ✂️\nבחרו תאריך:`,
    dates.slice(0, 5).map((d) => ({ id: `date_${d.date}`, title: d.label }))
  );
  return;
}
```

- [ ] **Step 4: Handle flow_specific — prompt for date**

Add handler:
```ts
if (interactionId === "flow_specific" && session.booking?.step === "select_date") {
  updateSession(from, businessPhoneNumberId, { bookingFlow: "specific" });
  await sendTextMessage(businessPhoneNumberId, from, "הקלידו תאריך בפורמט DD/MM/YYYY (לדוגמה: 30/12/2026)");
  return;
}
```

- [ ] **Step 5: Parse free-text date when bookingFlow is "specific"**

In the main text handler (before the greeting/booking patterns), add a check for pending specific-date input:

```ts
// Free-text date input for specific booking flow
if (session.booking?.step === "select_date" && session.bookingFlow === "specific") {
  const dateMatch = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dateMatch) {
    await sendTextMessage(businessPhoneNumberId, from, "פורמט לא תקין. הקלידו תאריך בפורמט DD/MM/YYYY (לדוגמה: 30/12/2026)");
    return;
  }
  
  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);
  const inputDate = new Date(year, month - 1, day);
  
  if (isNaN(inputDate.getTime())) {
    await sendTextMessage(businessPhoneNumberId, from, "תאריך לא תקין. נסו שוב.");
    return;
  }
  
  const today = getIsraelDate();
  const inputDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  
  if (inputDateStr < today.dateStr) {
    await sendTextMessage(businessPhoneNumberId, from, "לא ניתן לקבוע תור בתאריך שעבר. נסו תאריך עתידי.");
    return;
  }
  
  // Check max_future_days
  const { data: rules } = await getSupabase()
    .from("booking_rules")
    .select("max_future_days")
    .eq("business_id", ctx.biz.businessId)
    .single();
  const maxDays = rules?.max_future_days || 30;
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDays);
  if (inputDate > maxDate) {
    await sendTextMessage(businessPhoneNumberId, from, `ניתן לקבוע תור עד ${maxDays} ימים מראש. נסו תאריך קרוב יותר.`);
    return;
  }
  
  // Check availability
  const slots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, inputDateStr);
  if (slots.length === 0) {
    await sendTextMessage(businessPhoneNumberId, from, "אין שעות פנויות בתאריך זה. נסו תאריך אחר.");
    return;
  }
  
  // Proceed with date and show slots
  updateSession(from, businessPhoneNumberId, {
    booking: { ...session.booking, step: "select_time", date: inputDateStr },
  });
  
  await sendTimeSlotsGrouped(businessPhoneNumberId, from, session.booking.serviceName, inputDateStr, slots);
  return;
}
```

- [ ] **Step 6: Commit**

```bash
git add services/whatsapp-agent/src/index.ts services/whatsapp-agent/src/session.ts
git commit -m "feat: add quick/specific date selection flow to WhatsApp"
```

---

### Task 11: WhatsApp — time-of-day grouping (item 7)

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Remove 10-slot cap from getAvailableTimeSlots**

In `getAvailableTimeSlots`, change the loop condition from:
```ts
for (let m = startMin; m + duration <= endMin && slots.length < 10; m += step) {
```
To:
```ts
for (let m = startMin; m + duration <= endMin; m += step) {
```

- [ ] **Step 2: Create sendTimeSlotsGrouped function**

Add new function before `handleIncomingMessage`:

```ts
const TIME_GROUP_LABELS: Record<string, string> = {
  morning: "☀️ בוקר",
  noon: "🌤️ צהריים",
  evening: "🌙 אחה\"צ/ערב",
};

function groupTimeSlots(slots: { time: string; label: string }[]): Record<string, { time: string; label: string }[]> {
  const groups: Record<string, { time: string; label: string }[]> = { morning: [], noon: [], evening: [] };
  for (const slot of slots) {
    const h = parseInt(slot.label.split(":")[0], 10);
    if (h >= 6 && h < 12) groups.morning.push(slot);
    else if (h >= 12 && h < 16) groups.noon.push(slot);
    else groups.evening.push(slot);
  }
  return groups;
}

async function sendTimeSlotsGrouped(
  phoneNumberId: string,
  to: string,
  serviceName: string,
  date: string,
  slots: { time: string; label: string }[]
) {
  const grouped = groupTimeSlots(slots);
  const sections: { title: string; rows: { id: string; title: string }[] }[] = [];

  for (const [key, label] of Object.entries(TIME_GROUP_LABELS)) {
    const groupSlots = grouped[key] || [];
    if (groupSlots.length === 0) continue;
    sections.push({
      title: label,
      rows: groupSlots.slice(0, 10).map((s) => ({
        id: `time_${s.time}`,
        title: s.label,
      })),
    });
  }

  await sendListMessage(phoneNumberId, to,
    `${serviceName} • ${date.slice(5).replace("-", "/")}\nבחרו שעה:`,
    "הצג שעות",
    sections
  );
}
```

- [ ] **Step 3: Update the date selection handler to use sendTimeSlotsGrouped**

In both the `flow_quick` date handler and the existing date handler (`interactionId.startsWith("date_")`), replace the inline time slot sending with `sendTimeSlotsGrouped`:

```ts
await sendTimeSlotsGrouped(businessPhoneNumberId, from, session.booking.serviceName, date, slots);
```

Also update the flow_quick handler's `findNextAvailableDates` to return up to 5 dates (change `results.length < 3` to `results.length < 5`).

- [ ] **Step 4: Verify type-check**

Run: `pnpm --filter @torup/whatsapp-agent type-check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: add time-of-day grouping and remove slot cap in WhatsApp"
```

---

### Task 12: Manager notifications — backend (item 5)

**Files:**
- Modify: `apps/api/src/services/notifications.ts`
- Modify: `apps/api/src/routes/appointments.ts`

- [ ] **Step 1: Add sendManagerNotification function**

In `notifications.ts`, add after the existing `sendAppointmentNotification`:

```ts
export async function sendManagerNotification(appointmentId: string) {
  const supabase = createServiceClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, business_id, start_time, status, " +
      "customers(id, name, phone), " +
      "services(name_he)"
    )
    .eq("id", appointmentId)
    .single();

  if (!appointment) return;

  const apt = appointment as unknown as {
    id: string; business_id: string; start_time: string; status: string;
    customers: { id: string; name: string; phone: string };
    services: { name_he: string };
  };

  // Find the business owner
  const { data: owner } = await supabase
    .from("business_members")
    .select("user_id")
    .eq("business_id", apt.business_id)
    .eq("role", "owner")
    .single();

  if (!owner) return;

  // Get owner's phone from auth.users metadata (or customers table)
  const { data: ownerUser } = await supabase
    .from("users")
    .select("phone")
    .eq("id", owner.user_id)
    .single();

  const ownerPhone = ownerUser?.phone;
  if (!ownerPhone) return;

  const startDate = new Date(apt.start_time);
  const dateStr = startDate.toLocaleDateString("he-IL", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem" });
  const timeStr = startDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" });

  const message = `🔔 תור חדש!\n👤 ${apt.customers.name}\n✂️ ${apt.services.name_he}\n📅 ${dateStr} ⏰ ${timeStr}\n📱 ${apt.customers.phone}\n\nסטטוס: ממתין לאישור`;

  const whatsappToken = process.env.WHATSAPP_TOKEN;
  const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  let whatsappMessageId: string | null = null;
  try {
    if (whatsappToken && whatsappPhoneNumberId) {
      whatsappMessageId = await sendWhatsAppMessage(ownerPhone, message);
    }
  } catch (err) {
    console.error("Failed to send manager notification:", err);
  }

  await logNotification({
    business_id: apt.business_id,
    customer_id: apt.customers.id,
    appointment_id: appointmentId,
    type: "manager_new_booking",
    channel: "whatsapp",
    template_id: "manager_new_booking",
    status: whatsappMessageId ? "sent" : "failed",
    whatsapp_message_id: whatsappMessageId,
    error: whatsappMessageId ? undefined : "WhatsApp send failed or no token configured",
  });
}
```

- [ ] **Step 2: Call sendManagerNotification from appointments route**

In `apps/api/src/routes/appointments.ts`, import `sendManagerNotification` and call it after successful appointment creation in the POST handler:

```ts
// After the booking confirmation notification (line ~118):
sendManagerNotification(data.id).catch(() => {});
```

- [ ] **Step 3: Call sendManagerNotification from WhatsApp agent's createBooking**

In the WhatsApp agent's `createBooking` (in `index.ts`), after successful insert, call the API's internal notification endpoint. Since the WhatsApp agent runs separately, we POST to the API:

Add after successful insert in `createBooking`:
```ts
// Fire-and-forget: notify the manager
const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";
fetch(`${apiUrl}/api/internal/notify-manager`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-internal-secret": process.env.INTERNAL_SECRET || "" },
  body: JSON.stringify({ appointmentId: data?.[0]?.id }),
}).catch(() => {});
```

Wait — we need to get the appointment ID from the insert. Let's adjust the insert to return the ID:

```ts
const { data: inserted, error } = await supabase.from("appointments").insert({
  business_id: businessId,
  service_id: serviceId,
  customer_id: customerId,
  start_time: startTime,
  end_time: endTime,
  status: "pending_approval",
  created_via: "whatsapp",
}).select("id").single();
```

Then send the notification.

- [ ] **Step 4: Add internal endpoint for WhatsApp agent to trigger manager notification**

In `apps/api/src/routes/internal.ts`, add:

```ts
router.post("/notify-manager", requireInternalSecret, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) { res.status(400).json({ error: "appointmentId required" }); return; }
    await sendManagerNotification(appointmentId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
```

Import `sendManagerNotification` from `../services/notifications.js`.

- [ ] **Step 5: Verify type-check**

Run: `pnpm --filter @torup/api type-check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/notifications.ts apps/api/src/routes/appointments.ts apps/api/src/routes/internal.ts services/whatsapp-agent/src/index.ts
git commit -m "feat: send WhatsApp notification to business owner on new appointments"
```

---

### Task 13: Manager notifications — dashboard badge (item 5)

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Add pending approval count fetching**

The stats already fetch appointments for today. Add a count for `pending_approval` status. In the useEffect that fetches stats, add a second fetch:

```ts
// Fetch pending_approval count
apiFetch<Array<{ id: string }>>(
  `/api/businesses/${businessId}/appointments?status=pending_approval`,
  {},
  session.access_token
)
  .then((apts) => {
    if (Array.isArray(apts)) {
      setStats((prev) => ({ ...prev, pendingApproval: apts.length }));
    }
  })
  .catch(() => {});
```

Update `DayStats`:
```ts
interface DayStats {
  total: number;
  pending: number;
  completed: number;
  pendingApproval: number;
}
```

Initial stats:
```ts
const [stats, setStats] = useState<DayStats>({ total: 0, pending: 0, completed: 0, pendingApproval: 0 });
```

- [ ] **Step 2: Add badge to the "Pending" stat card**

Change the pending stat card to show a badge when there are pending_approval items:

```tsx
{ label: t("pending"), value: stats.pending, icon: Clock, color: "text-yellow-600", badge: stats.pendingApproval },
```

Then in the stat card rendering, conditionally show a red badge:

```tsx
{statCards.map((s) => (
  <Card key={s.label}>
    <CardContent className="flex items-center gap-4 p-4">
      <s.icon className={`h-8 w-8 ${s.color}`} />
      <div>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold">{s.value}</p>
          {'badge' in s && s.badge > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {s.badge}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{s.label}</p>
      </div>
    </CardContent>
  </Card>
))}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/dashboard/page.tsx
git commit -m "feat: add pending approval badge to dashboard"
```

---

### Task 14: Migration — google_calendar tables (item 8)

**Files:**
- Create: `supabase/migrations/00014_google_calendar.sql`

- [ ] **Step 1: Write migration**

```sql
-- 00014_google_calendar.sql
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  google_calendar_id TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS google_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  summary TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  UNIQUE(business_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_gcal_events_business_time
  ON google_calendar_events(business_id, start_time, end_time);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00014_google_calendar.sql
git commit -m "feat: add google calendar sync tables"
```

---

### Task 15: Google Calendar service (item 8)

**Files:**
- Create: `apps/api/src/services/google-calendar.ts`
- Modify: `apps/api/package.json` (add `googleapis` dep)

- [ ] **Step 1: Install googleapis**

```bash
pnpm --filter @torup/api add googleapis
```

- [ ] **Step 2: Write the Google Calendar service**

```ts
// apps/api/src/services/google-calendar.ts
import { google } from "googleapis";
import { createServiceClient } from "../lib/supabase.js";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export function getAuthUrl(businessId: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"],
    state: businessId,
  });
}

export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token: string; expires_at: Date }> {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing tokens from Google");
  }
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expiry_date!),
  };
}

async function getAuthClient(businessId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (!data) throw new Error("No Google Calendar connection");

  oauth2Client.setCredentials({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  // Refresh if expiring soon
  if (new Date(data.token_expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await supabase
      .from("google_calendar_tokens")
      .update({
        access_token: credentials.access_token,
        token_expires_at: new Date(credentials.expiry_date!).toISOString(),
      })
      .eq("business_id", businessId);
  }

  return oauth2Client;
}

export async function listCalendars(businessId: string) {
  const auth = await getAuthClient(businessId);
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.calendarList.list();
  return (res.data.items || []).map((c) => ({
    id: c.id!,
    summary: c.summary || c.id!,
    primary: c.primary || false,
  }));
}

export async function syncGoogleCalendar(businessId: string): Promise<{ imported: number; deleted: number; error?: string }> {
  const supabase = createServiceClient();

  const { data: config } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("business_id", businessId)
    .eq("sync_enabled", true)
    .single();

  if (!config || !config.google_calendar_id) return { imported: 0, deleted: 0 };

  try {
    const auth = await getAuthClient(businessId);
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const res = await calendar.events.list({
      calendarId: config.google_calendar_id,
      timeMin: now.toISOString(),
      timeMax: sixtyDaysLater.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items || [];
    let imported = 0;

    for (const event of events) {
      if (!event.id || !event.start?.dateTime || !event.end?.dateTime) continue;

      await supabase.from("google_calendar_events").upsert({
        business_id: businessId,
        google_event_id: event.id,
        summary: event.summary || "",
        start_time: event.start.dateTime,
        end_time: event.end.dateTime,
      }, { onConflict: "business_id,google_event_id" });
      imported++;
    }

    // Delete events no longer in Google (cancelled externally)
    const googleEventIds = events.map((e) => e.id!).filter(Boolean);
    const { count } = await supabase
      .from("google_calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

    let deleted = 0;
    if (googleEventIds.length > 0) {
      const { error: delErr } = await supabase
        .from("google_calendar_events")
        .delete()
        .eq("business_id", businessId)
        .not("google_event_id", "in", `(${googleEventIds.map((id) => `'${id}'`).join(",")})`);
      if (!delErr) deleted = (count ?? 0) - imported;
    }

    return { imported, deleted };
  } catch (err) {
    return { imported: 0, deleted: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function pushAppointmentToGoogle(appointmentId: string) {
  const supabase = createServiceClient();

  const { data: apt } = await supabase
    .from("appointments")
    .select("id, business_id, start_time, end_time, status, services(name_he), customers(name)")
    .eq("id", appointmentId)
    .single();

  if (!apt) return;

  const { data: config } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("business_id", apt.business_id)
    .eq("push_enabled", true)
    .single();

  if (!config || !config.google_calendar_id) return;

  try {
    const auth = await getAuthClient(apt.business_id);
    const calendar = google.calendar({ version: "v3", auth });

    const appointment = apt as unknown as {
      id: string; business_id: string; start_time: string; end_time: string; status: string;
      services: { name_he: string }; customers: { name: string };
    };

    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      // Get google_event_id from appointment
      const { data: apptWithGCal } = await supabase
        .from("appointments")
        .select("google_event_id")
        .eq("id", appointmentId)
        .single();

      if (apptWithGCal?.google_event_id) {
        await calendar.events.delete({
          calendarId: config.google_calendar_id,
          eventId: apptWithGCal.google_event_id,
        });
      }
      return;
    }

    const event = {
      summary: `${appointment.services.name_he} - ${appointment.customers.name}`,
      start: { dateTime: appointment.start_time },
      end: { dateTime: appointment.end_time },
    };

    // Check if we already have a google_event_id (update) or need to create
    const { data: existing } = await supabase
      .from("appointments")
      .select("google_event_id")
      .eq("id", appointmentId)
      .single();

    if (existing?.google_event_id) {
      await calendar.events.update({
        calendarId: config.google_calendar_id,
        eventId: existing.google_event_id,
        requestBody: event,
      });
    } else {
      const created = await calendar.events.insert({
        calendarId: config.google_calendar_id,
        requestBody: event,
      });
      if (created.data.id) {
        await supabase
          .from("appointments")
          .update({ google_event_id: created.data.id })
          .eq("id", appointmentId);
      }
    }
  } catch (err) {
    console.error("Failed to push appointment to Google Calendar:", err);
  }
}
```

- [ ] **Step 3: Verify type-check**

Run: `pnpm --filter @torup/api type-check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/google-calendar.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add Google Calendar sync service"
```

---

### Task 16: Google Calendar API routes (item 8)

**Files:**
- Create: `apps/api/src/routes/google-calendar.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the routes**

```ts
// apps/api/src/routes/google-calendar.ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth.js";
import { getBusinessId } from "../lib/params.js";
import { createServiceClient } from "../lib/supabase.js";
import { getAuthUrl, exchangeCode, listCalendars } from "../services/google-calendar.js";
import { AppError } from "../middleware/error-handler.js";

const router = Router({ mergeParams: true });

// GET /businesses/:businessId/google-calendar/auth-url
router.get(
  "/auth-url",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  (req: AuthenticatedRequest, res: Response) => {
    const businessId = getBusinessId(req);
    const url = getAuthUrl(businessId);
    res.json({ url });
  }
);

// POST /businesses/:businessId/google-calendar/connect
router.post(
  "/connect",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const businessId = getBusinessId(req);
      const { code } = req.body;
      if (!code) throw new AppError(400, "code required");

      const tokens = await exchangeCode(code);
      const supabase = createServiceClient();

      await supabase.from("google_calendar_tokens").upsert({
        business_id: businessId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_at.toISOString(),
      }, { onConflict: "business_id" });

      res.json({ connected: true });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /businesses/:businessId/google-calendar/connect
router.delete(
  "/connect",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      await supabase.from("google_calendar_tokens").delete().eq("business_id", getBusinessId(req));
      await supabase.from("google_calendar_events").delete().eq("business_id", getBusinessId(req));
      res.json({ disconnected: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/google-calendar/status
router.get(
  "/status",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("google_calendar_tokens")
        .select("sync_enabled, push_enabled, google_calendar_id, updated_at")
        .eq("business_id", getBusinessId(req))
        .single();

      if (!data) { res.json({ connected: false }); return; }

      let calendars: { id: string; summary: string; primary: boolean }[] = [];
      try {
        calendars = await listCalendars(getBusinessId(req));
      } catch {}

      res.json({ connected: true, ...data, calendars });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /businesses/:businessId/google-calendar/settings
router.patch(
  "/settings",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { google_calendar_id, sync_enabled, push_enabled } = req.body;
      const update: Record<string, unknown> = {};
      if (google_calendar_id !== undefined) update.google_calendar_id = google_calendar_id;
      if (sync_enabled !== undefined) update.sync_enabled = sync_enabled;
      if (push_enabled !== undefined) update.push_enabled = push_enabled;

      await supabase.from("google_calendar_tokens").update(update).eq("business_id", getBusinessId(req));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

- [ ] **Step 2: Mount the routes in index.ts**

In `apps/api/src/index.ts`, add:
```ts
import googleCalendarRouter from "./routes/google-calendar.js";
```

And mount:
```ts
app.use("/api/businesses/:businessId/google-calendar", googleCalendarRouter);
```

- [ ] **Step 3: Add sync cron endpoint to internal routes**

In `apps/api/src/routes/internal.ts`:
```ts
import { syncGoogleCalendar } from "../services/google-calendar.js";

router.post("/google-calendar/sync", requireInternalSecret, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data: businesses } = await supabase
      .from("google_calendar_tokens")
      .select("business_id")
      .eq("sync_enabled", true);

    const results: { business_id: string; imported: number; deleted: number; error?: string }[] = [];
    for (const row of businesses || []) {
      const r = await syncGoogleCalendar(row.business_id);
      results.push({ business_id: row.business_id, ...r });
    }

    res.json({ synced: results.length, results });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Verify type-check**

Run: `pnpm --filter @torup/api type-check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/google-calendar.ts apps/api/src/index.ts apps/api/src/routes/internal.ts
git commit -m "feat: add Google Calendar API routes and sync cron"
```

---

### Task 17: Update availability to include Google Calendar events (item 8)

**Files:**
- Modify: `apps/api/src/routes/availability.ts`
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Update API availability route**

In `availability.ts`, add a query to `google_calendar_events` alongside the existing appointments query in the `Promise.all`:

```ts
const [whResult, brResult, aptResult, rulesResult, gcalResult] = await Promise.all([
  // ... existing queries ...
  supabase
    .from("google_calendar_events")
    .select("start_time, end_time, summary")
    .eq("business_id", businessId)
    .gte("start_time", `${dateStr}T00:00:00`)
    .lte("start_time", `${dateStr}T23:59:59`),
]);
```

Then convert gcal events to ExistingAppointment format and include them:
```ts
const gcalAppointments: ExistingAppointment[] = (gcalResult.data || []).map(
  (e: Record<string, unknown>) => ({
    startTime: new Date(e.start_time as string),
    endTime: new Date(e.end_time as string),
    staffId: null,
  })
);

const existingAppointments: ExistingAppointment[] = [
  ...(aptResult.data || []).map((a: Record<string, unknown>) => ({
    startTime: new Date(a.start_time as string),
    endTime: new Date(a.end_time as string),
    staffId: a.staff_id as string | null,
  })),
  ...gcalAppointments,
];
```

- [ ] **Step 2: Update WhatsApp agent getAvailableTimeSlots**

In `index.ts`, in `getAvailableTimeSlots`, add a query to `google_calendar_events`:

```ts
const [hoursRes, serviceRes, aptsRes, gcalRes] = await Promise.all([
  // ... existing queries ...
  supabase.from("google_calendar_events").select("start_time, end_time")
    .eq("business_id", businessId)
    .gte("start_time", `${date}T00:00:00`).lt("start_time", `${date}T23:59:59`),
]);
```

Then include gcal events in conflict detection:
```ts
const allConflicts = [
  ...(aptsRes.data || []),
  ...(gcalRes.data || []).map((e: any) => ({ start_time: e.start_time, end_time: e.end_time })),
];
const conflicts = allConflicts.filter((a: any) => a.start_time < slotEndUTC && a.end_time > slotStartUTC);
```

- [ ] **Step 3: Verify type-check**

Run: `pnpm --filter @torup/api type-check && pnpm --filter @torup/whatsapp-agent type-check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/availability.ts services/whatsapp-agent/src/index.ts
git commit -m "feat: include Google Calendar events in availability checks"
```

---

### Task 18: Settings UI — Google Calendar integration (item 8)

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/settings/page.tsx`

- [ ] **Step 1: Add "calendar" tab and Google Calendar state**

Add to `Tab` type: `"calendar"`.
Add to tabs array: `{ key: "calendar", label: t("googleCalendar") }`.

State:
```ts
const [gcalConnected, setGcalConnected] = useState(false);
const [gcalSyncEnabled, setGcalSyncEnabled] = useState(true);
const [gcalPushEnabled, setGcalPushEnabled] = useState(true);
const [gcalCalendars, setGcalCalendars] = useState<{ id: string; summary: string; primary: boolean }[]>([]);
const [gcalSelectedCalendar, setGcalSelectedCalendar] = useState("");
```

- [ ] **Step 2: Fetch Google Calendar status in fetchTab**

```ts
} else if (tab === "calendar") {
  const r = await apiFetch<{ connected: boolean; sync_enabled?: boolean; push_enabled?: boolean; google_calendar_id?: string; calendars?: { id: string; summary: string; primary: boolean }[] }>(
    `/api/businesses/${businessId}/google-calendar/status`, {}, token
  );
  if (r.connected) {
    setGcalConnected(true);
    setGcalSyncEnabled(r.sync_enabled ?? true);
    setGcalPushEnabled(r.push_enabled ?? true);
    setGcalSelectedCalendar(r.google_calendar_id || "");
    setGcalCalendars(r.calendars || []);
  } else {
    setGcalConnected(false);
  }
}
```

- [ ] **Step 3: Handlers for connect/disconnect/save**

```ts
const connectGCal = async () => {
  try {
    const r = await apiFetch<{ url: string }>(`/api/businesses/${businessId}/google-calendar/auth-url`, {}, token);
    window.location.href = r.url;
  } catch {}
};

const disconnectGCal = async () => {
  await apiFetch(`/api/businesses/${businessId}/google-calendar/connect`, { method: "DELETE" }, token);
  setGcalConnected(false);
};

const saveGCalSettings = async () => {
  setSaving(true);
  try {
    await apiFetch(`/api/businesses/${businessId}/google-calendar/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        google_calendar_id: gcalSelectedCalendar || null,
        sync_enabled: gcalSyncEnabled,
        push_enabled: gcalPushEnabled,
      }),
    }, token);
    showSaved();
  } catch {} finally { setSaving(false); }
};
```

- [ ] **Step 4: Handle OAuth callback**

Add a useEffect that checks for `?code=` in the URL:

```ts
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code && businessId && token) {
    apiFetch(`/api/businesses/${businessId}/google-calendar/connect`, {
      method: "POST",
      body: JSON.stringify({ code }),
    }, token)
      .then(() => {
        window.history.replaceState({}, "", window.location.pathname);
        setGcalConnected(true);
        fetchTab();
      })
      .catch(() => {});
  }
}, [businessId, token]);
```

- [ ] **Step 5: Add the "calendar" tab UI**

```tsx
{tab === "calendar" && (
  <div className="space-y-4 max-w-md">
    {!gcalConnected ? (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-4">{t("connectGCalDesc")}</p>
        <Button onClick={connectGCal}>{t("connectGCal")}</Button>
      </div>
    ) : (
      <>
        <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-sm text-green-700 font-medium">✅ {t("gcalConnected")}</span>
          <button onClick={disconnectGCal} className="text-red-500 text-xs hover:underline">{tCommon("disconnect")}</button>
        </div>

        {gcalCalendars.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">{t("selectCalendar")}</label>
            <select
              value={gcalSelectedCalendar}
              onChange={(e) => setGcalSelectedCalendar(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {gcalCalendars.map((c) => (
                <option key={c.id} value={c.id}>{c.summary}{c.primary ? ` (${t("primary")})` : ""}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{t("syncFromGCal")}</p>
            <p className="text-xs text-muted-foreground">{t("syncFromGCalDesc")}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={gcalSyncEnabled} onChange={(e) => setGcalSyncEnabled(e.target.checked)}
              className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{t("pushToGCal")}</p>
            <p className="text-xs text-muted-foreground">{t("pushToGCalDesc")}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={gcalPushEnabled} onChange={(e) => setGcalPushEnabled(e.target.checked)}
              className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        <button onClick={saveGCalSettings} disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
          {tCommon("save")}
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 6: Add translation keys**

Add: `googleCalendar`, `connectGCal`, `connectGCalDesc`, `gcalConnected`, `selectCalendar`, `primary`, `syncFromGCal`, `syncFromGCalDesc`, `pushToGCal`, `pushToGCalDesc`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/[locale]/dashboard/settings/page.tsx packages/i18n/
git commit -m "feat: add Google Calendar integration to settings UI"
```

---

### Task 19: Push appointments to Google Calendar on CRUD (item 8)

**Files:**
- Modify: `apps/api/src/routes/appointments.ts`

- [ ] **Step 1: Call pushAppointmentToGoogle on create/update/status change**

Import `pushAppointmentToGoogle` from `../services/google-calendar.js`.

In the POST handler, after successful creation:
```ts
pushAppointmentToGoogle(data.id).catch(() => {});
```

In the PATCH status handler, after status update:
```ts
pushAppointmentToGoogle(appointmentId).catch(() => {});
```

In the approve handler, after approval:
```ts
pushAppointmentToGoogle(appointmentId).catch(() => {});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/appointments.ts
git commit -m "feat: push appointment changes to Google Calendar"
```

---

## Environment Variables to Add

```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REDIRECT_URI=https://<domain>/api/businesses/google-calendar/callback
```
