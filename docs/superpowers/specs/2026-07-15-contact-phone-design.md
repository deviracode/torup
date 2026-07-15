# Contact Phone Field — Design Spec

**Date:** 2026-07-15  
**Status:** Approved

---

## Overview

The existing `phone` field on `businesses` serves two purposes: receiving manager approval notifications from the bot, and being the cancel-redirect number sent to customers. This spec separates them by adding an optional `contact_phone` field. If set, it is used for the customer-facing cancel redirect. If not set, falls back to `phone`.

---

## Database

Add a nullable column to `businesses`:

```sql
ALTER TABLE businesses ADD COLUMN contact_phone TEXT;
```

- No `NOT NULL` constraint, no default.
- Existing rows get `NULL` → fallback to `phone`.

---

## WhatsApp Agent

**File:** `services/whatsapp-agent/src/index.ts`

### `resolveBusinessId` return type

Add `contactPhone: string | null` to the returned object:

```typescript
{ businessId: string; businessName: string; phone: string; contactPhone: string | null; allowMultipleBookings: boolean; botContext: string | null }
```

### DB query

Add `contact_phone` to the select in `resolveBusinessId`:

```typescript
.select("id, name, phone, contact_phone, allow_multiple_bookings, bot_context")
```

Map to: `contactPhone: data.contact_phone ?? null`

### Cache type

Update the `bizCache` map value type to include `contactPhone: string | null`.

### Cancel redirect

Replace:
```typescript
const managerPhone = ctx.biz.phone.replace(/[^0-9]/g, "");
```

With (in all locations — `menu_cancel` handler, `menu_my_appointments` processMessage call, free-text processMessage call):
```typescript
const managerPhone = (ctx.biz.contactPhone ?? ctx.biz.phone).replace(/[^0-9]/g, "");
```

---

## Admin Settings

**File:** `apps/web/src/app/[locale]/admin/page.tsx`

Add a "Contact Phone" input field below the existing Phone field in both:
- The **onboard** dialog (formData state)
- The **edit** dialog (editBusiness state)

Label: "Contact Phone / טלפון ליצירת קשר"  
Input: `dir="ltr"`, optional, no required attribute.  
State field: `contact_phone`  
Included in PATCH/POST payload alongside existing `phone`.

---

## Dashboard Settings

**File:** `apps/web/src/app/[locale]/dashboard/settings/page.tsx`

Add "טלפון ליצירת קשר" input field below the existing phone field in the Business Profile tab.  
State field: `contact_phone` on the `profile` object.  
Saved via existing PATCH `/api/businesses/{businessId}`.

---

## API / Validation

**File:** `packages/shared/src/schemas/business.ts`

Add to `updateBusinessSchema`:
```typescript
contact_phone: z.string().min(9).max(20).optional().nullable(),
```

No other API changes — the existing PATCH endpoint already handles partial updates.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/<next>_add_contact_phone.sql` | Add `contact_phone TEXT` column |
| `services/whatsapp-agent/src/index.ts` | Add field to select, cache type, fallback logic |
| `apps/web/src/app/[locale]/admin/page.tsx` | Add Contact Phone field to both dialogs |
| `apps/web/src/app/[locale]/dashboard/settings/page.tsx` | Add Contact Phone field to profile tab |
| `packages/shared/src/schemas/business.ts` | Add `contact_phone` to updateBusinessSchema |

---

## Out of Scope

- Validation beyond min/max length
- Displaying contact phone anywhere other than the cancel redirect
- Making contact phone required
