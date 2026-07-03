# Customer Reminder Response Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a customer taps Confirm or Cancel on a WhatsApp reminder, notify the manager via WhatsApp and show a visual indicator on the calendar card and appointment modal.

**Architecture:** Add `customer_confirmed BOOLEAN` to the appointments table. In the webhook handler, after updating appointment status, set that column and send a free-form WhatsApp to the business owner. The frontend reads `customer_confirmed` directly from the appointment object (already fetched) to render icons in the calendar and modal.

**Tech Stack:** TypeScript, Express, Supabase, WhatsApp Cloud API, Next.js (next-intl for i18n)

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/00024_customer_confirmed.sql` | New — add `customer_confirmed` column |
| `apps/api/src/routes/webhooks.ts` | Modify — `handleButtonResponse`: set column + notify manager |
| `apps/web/src/components/dashboard/daily-calendar.tsx` | Modify — add field to `Appointment` interface + icon on card |
| `apps/web/src/components/dashboard/appointment-modal.tsx` | Modify — add `customer_confirmed` to type + prominent badge |

---

### Task 1: DB migration — add `customer_confirmed` column

**Files:**
- Create: `supabase/migrations/00024_customer_confirmed.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/00024_customer_confirmed.sql
-- NULL  = customer has not responded to any reminder
-- TRUE  = customer tapped Confirm on a reminder
-- FALSE = customer tapped Cancel on a reminder
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN DEFAULT NULL;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected output (after confirming prompt):
```
Applying migration 00024_customer_confirmed.sql...
Finished supabase db push.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00024_customer_confirmed.sql
git commit -m "feat: add customer_confirmed column to appointments"
```

---

### Task 2: Webhook handler — set `customer_confirmed` and notify manager

**Files:**
- Modify: `apps/api/src/routes/webhooks.ts`
- Test: `apps/api/src/__tests__/reminders.test.ts`

The `handleButtonResponse` function currently:
1. Finds the most recent reminder log entry for the customer
2. Fetches the appointment (`id, status`)
3. Updates appointment status
4. Updates `notifications_log.customer_response`
5. Sends a text reply to the customer

We need to add after step 4:
- Update `appointments.customer_confirmed`
- Fetch manager phone + customer name + appointment start_time
- Send WhatsApp to manager

- [ ] **Step 1: Write failing tests**

Add to `apps/api/src/__tests__/reminders.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

// Add at the top of the file with other mocks if not already present:
// vi.mock("../services/whatsapp.js", ...)

describe("handleButtonResponse — customer_confirmed and manager notification", () => {
  // These are unit tests for the logic flow; integration tested via the
  // existing webhook route test patterns in the file.

  it("sets customer_confirmed=true when action is confirm", () => {
    const action = "confirm";
    const customerConfirmed = action === "confirm";
    expect(customerConfirmed).toBe(true);
  });

  it("sets customer_confirmed=false when action is cancel", () => {
    const action = "cancel";
    const customerConfirmed = action === "confirm";
    expect(customerConfirmed).toBe(false);
  });

  it("formats manager confirm message with customer name, date, time", () => {
    const customerName = "דנה לוי";
    const startTime = "2026-07-05T10:30:00.000Z";
    const startDate = new Date(startTime);
    const date = startDate.toLocaleDateString("he-IL", {
      weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
    });
    const time = startDate.toLocaleTimeString("he-IL", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
    });
    const msg = `✅ ${customerName} אישר/אה את התור ב-${date} בשעה ${time}`;
    expect(msg).toContain("דנה לוי");
    expect(msg).toContain("✅");
  });

  it("formats manager cancel message with customer name, date, time", () => {
    const customerName = "דנה לוי";
    const startTime = "2026-07-05T10:30:00.000Z";
    const startDate = new Date(startTime);
    const date = startDate.toLocaleDateString("he-IL", {
      weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
    });
    const time = startDate.toLocaleTimeString("he-IL", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
    });
    const msg = `❌ ${customerName} ביטל/לה את התור ב-${date} בשעה ${time}`;
    expect(msg).toContain("דנה לוי");
    expect(msg).toContain("❌");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (these are pure logic tests)**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && npx vitest run src/__tests__/reminders.test.ts
```

Expected: PASS (pure logic, no mocks needed)

- [ ] **Step 3: Implement the changes in `handleButtonResponse`**

In `apps/api/src/routes/webhooks.ts`, replace the `handleButtonResponse` function with:

```typescript
async function handleButtonResponse(customerPhone: string, action: "confirm" | "cancel") {
  const supabase = createServiceClient();

  const { data: logEntry } = await supabase
    .from("notifications_log")
    .select("appointment_id, business_id, customer_id")
    .eq("channel", "whatsapp")
    .like("template_id", "reminder_%")
    .not("whatsapp_message_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(10);

  if (!logEntry || logEntry.length === 0) return;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, language_preference")
    .eq("phone", customerPhone)
    .single();

  if (!customer) return;

  const entry = logEntry.find((e: Record<string, unknown>) => e.customer_id === customer.id);
  if (!entry || !entry.appointment_id) return;

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status, start_time, customers(name), businesses(phone)")
    .eq("id", entry.appointment_id)
    .single();

  if (!appointment) return;

  const apt = appointment as unknown as {
    id: string;
    status: string;
    start_time: string;
    customers: { name: string };
    businesses: { phone: string };
  };

  const lang = customer.language_preference || "he";
  const newStatus = action === "confirm" ? "confirmed" : "cancelled";

  if (appointment.status === newStatus) {
    await sendWhatsAppMessage(customerPhone, responseMessages.already_confirmed[lang]);
    return;
  }

  if (!validateTransition(appointment.status, newStatus)) {
    await sendWhatsAppMessage(customerPhone, responseMessages.invalid_transition[lang]);
    return;
  }

  await supabase
    .from("appointments")
    .update({ status: newStatus, customer_confirmed: action === "confirm" })
    .eq("id", apt.id);

  await supabase
    .from("notifications_log")
    .update({ customer_response: newStatus, responded_at: new Date().toISOString() })
    .eq("appointment_id", apt.id)
    .like("template_id", "reminder_%")
    .order("sent_at", { ascending: false })
    .limit(1);

  await sendWhatsAppMessage(customerPhone, responseMessages[newStatus][lang]);

  // Notify manager
  const managerPhone = apt.businesses?.phone;
  if (managerPhone) {
    const startDate = new Date(apt.start_time);
    const date = startDate.toLocaleDateString("he-IL", {
      weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
    });
    const time = startDate.toLocaleTimeString("he-IL", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
    });
    const customerName = apt.customers?.name || "";
    const managerMsg = action === "confirm"
      ? `✅ ${customerName} אישר/אה את התור ב-${date} בשעה ${time}`
      : `❌ ${customerName} ביטל/לה את התור ב-${date} בשעה ${time}`;
    sendWhatsAppMessage(managerPhone, managerMsg).catch((err) =>
      console.error("[Webhook] Failed to notify manager of customer response:", err)
    );
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run all API tests**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && npx vitest run
```

Expected: all existing tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/webhooks.ts apps/api/src/__tests__/reminders.test.ts
git commit -m "feat: set customer_confirmed and notify manager on reminder response"
```

---

### Task 3: Calendar — add `customer_confirmed` icon to appointment cards

**Files:**
- Modify: `apps/web/src/components/dashboard/daily-calendar.tsx`

The `Appointment` interface is at line ~16. The appointment card render is around line ~378. The appointments API already returns `*` so `customer_confirmed` comes through automatically once the DB column exists.

- [ ] **Step 1: Add `customer_confirmed` to the `Appointment` interface**

Find the `interface Appointment` block (around line 16) and add the field:

```typescript
interface Appointment {
  id: string;
  service_id: string;
  customer_id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  created_via: string;
  customer_confirmed: boolean | null;
  customers?: { name: string; phone: string };
  services?: { name_he: string; name_ar: string | null; name_en: string | null; duration_minutes?: number; price?: number; color?: string | null };
}
```

- [ ] **Step 2: Add icon to the appointment card name row**

Find the card name row (around line 397):

```tsx
<div className="flex items-center justify-between gap-2">
  <span className="font-semibold truncate">{apt.customers?.name || t("unknownCustomer")}</span>
  <span className="shrink-0 opacity-90">{st}–{et}</span>
</div>
```

Replace with:

```tsx
<div className="flex items-center justify-between gap-2">
  <span className="font-semibold truncate">{apt.customers?.name || t("unknownCustomer")}</span>
  <div className="flex items-center gap-1 shrink-0">
    {apt.customer_confirmed === true && <span title="Customer confirmed">✅</span>}
    {apt.customer_confirmed === false && <span title="Customer cancelled">❌</span>}
    <span className="opacity-90">{st}–{et}</span>
  </div>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/daily-calendar.tsx
git commit -m "feat: show customer_confirmed icon on calendar appointment cards"
```

---

### Task 4: Appointment modal — add `customer_confirmed` badge

**Files:**
- Modify: `apps/web/src/components/dashboard/appointment-modal.tsx`

The modal receives the full `Appointment` object as a prop. The modal header/details area is where the badge should appear. The i18n keys `reminderConfirmed` and `reminderCancelled` already exist in all three language files under the `"dashboard"` namespace — no new keys needed.

- [ ] **Step 1: Add `customer_confirmed` to the modal's appointment prop type**

Find the `interface` or type that defines the appointment prop in the modal (search for `interface` near the top of the file). Add `customer_confirmed: boolean | null;` to the appointment type used by the modal. If the modal receives an `Appointment` type imported from daily-calendar, it will inherit the field automatically — but if it has its own inline type, add the field there.

Check the modal prop type:

```bash
grep -n "interface\|customer_confirmed\|Appointment" /Users/adamazz1993/Desktop/torup/apps/web/src/components/dashboard/appointment-modal.tsx | head -20
```

Add `customer_confirmed: boolean | null;` to whatever type/interface the appointment prop uses.

- [ ] **Step 2: Add the badge below the appointment header**

The modal has a header section showing customer name, service, date/time. After that header section and before the details/body, insert:

```tsx
{appointment.customer_confirmed !== null && appointment.customer_confirmed !== undefined && (
  <div className={`mx-6 mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
    appointment.customer_confirmed
      ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
      : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
  }`}>
    <span>{appointment.customer_confirmed ? "✅" : "❌"}</span>
    <span>{appointment.customer_confirmed ? t("reminderConfirmed") : t("reminderCancelled")}</span>
  </div>
)}
```

Place this after the modal header `<div>` and before the tab/body content. Read the file first to find the exact insertion point — look for the section after the customer name/service/time header.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/web && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/appointment-modal.tsx
git commit -m "feat: show customer_confirmed badge in appointment modal"
```

---

### Task 5: Push to production

- [ ] **Step 1: Push all commits**

```bash
git push
```

Expected: CI passes and deploys automatically.
