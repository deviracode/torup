# Service Categories — Design Spec
**Date:** 2026-06-06

## Problem

The business has 20+ services. WhatsApp list messages cap at 10 rows, forcing services to be hidden. There is also no logical grouping — customers see a flat list with no way to navigate by type of service.

## Goal

Group services under optional categories (e.g. תסרוקות, תספורות, החלקות, פין). When categories exist, both WhatsApp and the web booking page show a two-step picker: choose category → choose service. The category step is fully bypassed when not needed (no categories set up, all services uncategorized, or intent extraction already identified the service).

---

## Section 1: Database & API

### New table: `service_categories`

```sql
CREATE TABLE service_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name_he      TEXT NOT NULL,
  name_ar      TEXT,
  name_en      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

### Services table migration

```sql
ALTER TABLE services
  ADD COLUMN category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL;
```

`ON DELETE SET NULL` means deleting a category gracefully uncategorizes its services — no data loss.

### API endpoints

**New resource:** `GET|POST /businesses/:businessId/categories`
- `GET` returns categories ordered by `sort_order`
- `POST` creates a category (`name_he` required, `name_ar`/`name_en` optional)

**New resource:** `PATCH|DELETE /businesses/:businessId/categories/:categoryId`
- `PATCH` updates name or `sort_order`
- `DELETE` removes the category; services become uncategorized via FK cascade

**Existing services endpoints:** `category_id` is now included in GET responses and accepted in POST/PATCH bodies. The `GET /businesses/:businessId/services` response also includes a top-level `categories` array so clients can group services without a second fetch.

```json
{
  "categories": [
    { "id": "...", "name_he": "תסרוקות", "name_ar": "تسريحات", "name_en": "Hairstyles", "sort_order": 0 }
  ],
  "services": [
    { "id": "...", "name_he": "תסרוקת ערב - פזור", "category_id": "...", ... }
  ]
}
```

---

## Section 2: Dashboard — Services Tab

A new **"Services"** tab is added to the settings page alongside hours, breaks, reminders, etc.

### Layout

Services are shown grouped by category (ordered by `sort_order`), with uncategorized services in an "ללא קטגוריה" section at the bottom.

Each service row/card includes:
- Name (Hebrew), duration, price
- **Category dropdown** — lists existing categories + "＋ קטגוריה חדשה" at the bottom
- Selecting "＋ קטגוריה חדשה" opens an inline form: `name_he` (required), `name_ar` and `name_en` (optional) → POST /categories → new category appears in all dropdowns immediately
- Existing edit (name, duration, price, descriptions) and delete actions

### Category reordering

Category headers have up/down arrow buttons. Each press calls `PATCH /categories/:id` with the updated `sort_order`. Simple and reliable — no drag-and-drop complexity.

### No existing services UI

There is currently no services tab in settings. This tab is fully new. It uses the same card/form patterns as the hours and reminders tabs.

---

## Section 3: WhatsApp Two-Step Picker

### Trigger condition

Category step is shown only when:
- The business has at least one category that has at least one service assigned

If the above is false, `sendServiceList` works exactly as today (flat list).

### Step 1 — Category picker

`sendCategoryList(phoneNumberId, to, categories, hasUncategorized, language)` sends a WhatsApp list message:
- One row per category: `id: "category_<uuid>"`, title: localized category name
- If uncategorized services exist: extra row at bottom `id: "category_uncategorized"`, title: "שירותים נוספים / خدمات إضافية / More services"

### Step 2 — Service picker

When `interactionId` starts with `"category_"`:
- Extract the category ID (or `"uncategorized"`)
- Filter `ctx.services` to that category
- Call `sendServiceList` with the filtered list
- Session state gets `booking.categoryId` set

### Bypass rules

| Condition | Behavior |
|-----------|----------|
| Intent extraction: `confidence === "high"` with `service_id` | Skip category step, jump to date/time as today |
| No categories with assigned services | Flat `sendServiceList` as today |
| All services uncategorized | Flat `sendServiceList` as today |

### Session state

`BookingState` gains optional `categoryId?: string`. Used only for tracking; no new flow branches needed.

---

## Section 4: Web Booking Page Two-Step Picker

### Trigger condition

Same as WhatsApp: at least one category has at least one assigned service.

### Step 1 — Category grid

Replaces the service grid when categories exist. Same card layout:
- Category name (localized: `name_ar` if Arabic, `name_en` if English, else `name_he`)
- Service count: "5 שירותים" / "5 خدمات" / "5 services"
- Clicking sets `selectedCategory` state → renders Step 2

Uncategorized services (if any): card labeled "שירותים נוספים" at the end.

### Step 2 — Service grid

Same as the current flat grid, filtered to `selectedCategory`. A back button ("← חזרה לקטגוריות") resets `selectedCategory` to null, returning to Step 1.

### Data source

The booking page already fetches services from `/businesses/:id/services`. With the updated API response shape (`{ categories: [...], services: [...] }`), the frontend groups services client-side using `category_id`. No second fetch needed.

### Bypass

If no categories exist (old API shape, flat array) or all services are uncategorized: existing flat grid, no change.

---

## What Does NOT Change

- Existing `sendServiceList` function signature and behavior when no categories apply
- The appointment creation flow after a service is selected
- `extractBookingIntent` — it already returns `service_id` directly, bypassing menus entirely
- Reminder notifications, approval flow, manager notifications
- Any existing service API contract for clients not sending `category_id`

---

## Migration Strategy

1. Add DB migration (new table + nullable column)
2. Existing services work immediately — `category_id` is NULL, bypass logic kicks in
3. Owner assigns categories from the dashboard; two-step picker activates automatically once any category has services
4. Zero downtime, fully backward compatible
