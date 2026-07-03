# Customer Reminder Response Flow — Design Spec

## Goal

Close the loop when a customer responds to a WhatsApp reminder by tapping Confirm or Cancel:
- Notify the manager immediately via WhatsApp
- Show a visual indicator on the calendar appointment card and appointment modal

## Context

When a customer receives an interactive reminder, they can tap **Confirm** or **Cancel**. The system already:
- Updates the appointment status (`confirmed` or `cancelled`)
- Logs `customer_response` on `notifications_log`
- Sends a reply back to the customer

What is missing:
- Manager is never notified of the customer's response
- The calendar and appointment modal have no visible indicator that the customer explicitly confirmed or cancelled via the reminder

---

## Architecture

### New DB Column

```sql
ALTER TABLE appointments
  ADD COLUMN customer_confirmed BOOLEAN DEFAULT NULL;
```

| Value | Meaning |
|-------|---------|
| `NULL` | Customer has not yet responded to a reminder |
| `TRUE` | Customer tapped Confirm on a reminder |
| `FALSE` | Customer tapped Cancel on a reminder |

This is separate from `status`. A `confirmed` appointment could have `customer_confirmed = NULL` (manager confirmed it) or `customer_confirmed = TRUE` (customer confirmed it via reminder).

---

## Backend Changes

### File: `apps/api/src/routes/webhooks.ts`

**Function: `handleButtonResponse`**

After the existing `appointments` status update and `notifications_log` update, add:

1. **Update `customer_confirmed` on the appointment:**
   ```typescript
   await supabase
     .from("appointments")
     .update({ customer_confirmed: action === "confirm" })
     .eq("id", appointment.id);
   ```

2. **Notify the manager via WhatsApp:**
   - Fetch appointment details: `customer name`, `start_time`, `business phone`
   - Format date/time in Israel timezone (`Asia/Jerusalem`)
   - Send free-form WhatsApp to the business owner's phone:
     - Confirm: `"✅ {customer_name} אישר/אה את התור ב-{date} בשעה {time}"`
     - Cancel: `"❌ {customer_name} ביטל/לה את התור ב-{date} בשעה {time}"`
   - Use `sendWhatsAppMessage` (free-form text — managers are daily active users, 24h window always open)
   - Failure to send manager notification must NOT block or throw — wrap in `.catch()`

---

## Frontend Changes

### File: `apps/web/src/components/dashboard/daily-calendar.tsx`

**`Appointment` interface** — add field:
```typescript
customer_confirmed?: boolean | null;
```

The field is returned automatically by the existing appointments API (route selects `*`).

**Calendar appointment card** — in the existing `flex items-center justify-between` name row, append an icon after the customer name when `customer_confirmed !== null`:
- `customer_confirmed === true` → `✅` icon
- `customer_confirmed === false` → `❌` icon

The icon sits inline, `shrink-0`, so it doesn't affect the layout when absent.

---

### File: `apps/web/src/components/dashboard/appointment-modal.tsx`

The modal already receives the full appointment object. When `customer_confirmed !== null`, render a badge below the appointment header (above the service/time details):

- `customer_confirmed === true` → green badge: `"הלקוח אישר את התור ✓"` (Hebrew) / `"Customer confirmed ✓"` (English) / `"العميل أكد الموعد ✓"` (Arabic)
- `customer_confirmed === false` → red badge: `"הלקוח ביטל את התור ✗"` / `"Customer cancelled ✗"` / `"العميل ألغى الموعد ✗"`

Use i18n keys (`reminderCustomerConfirmed`, `reminderCustomerCancelled`) consistent with existing reminder response keys in the modal.

---

## Data Flow

```
Customer taps Confirm/Cancel on WhatsApp reminder
  → webhooks.ts handleButtonResponse
    → UPDATE appointments SET status = newStatus
    → UPDATE appointments SET customer_confirmed = true/false
    → UPDATE notifications_log SET customer_response = newStatus
    → sendWhatsAppMessage(customer, "Your appointment is confirmed/cancelled")
    → sendWhatsAppMessage(manager, "✅/❌ {name} confirmed/cancelled")
  → Supabase realtime fires on appointments table
    → Calendar re-fetches appointments
      → Calendar card shows ✅/❌ icon
      → Appointment modal (if open) shows badge
```

---

## What Is Not Changing

- Appointment status transitions — unchanged
- `notifications_log.customer_response` — still updated as before
- The reminder sending logic — unchanged
- Manager approval flow for `pending_approval` appointments — unchanged

---

## Error Handling

- Manager WhatsApp notification failure: logged, does not block the customer response flow
- If business has no phone number: skip manager notification silently
- `customer_confirmed` update failure: logged as error, does not block status update

---

## i18n Keys to Add

| Key | He | Ar | En |
|-----|----|----|-----|
| `reminderCustomerConfirmed` | הלקוח אישר את התור ✓ | العميل أكد الموعد ✓ | Customer confirmed ✓ |
| `reminderCustomerCancelled` | הלקוח ביטל את התור ✗ | العميل ألغى الموعد ✗ | Customer cancelled ✗ |
