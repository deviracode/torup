# Service Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group services under optional categories with a two-step picker in WhatsApp and the web booking page, solving the 10-item WhatsApp list limit.

**Architecture:** New `service_categories` table + nullable `category_id` on `services`. API returns `{ categories, services }` shape. WhatsApp agent adds `sendCategoryList` and a `category_<id>` interactionId handler. Web booking page adds a category-first step before the service grid. Dashboard settings gets a new Services tab with inline category assignment per service.

**Tech Stack:** Supabase (PostgreSQL), Express, TypeScript, React/Next.js, next-intl, WhatsApp Cloud API

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/00018_service_categories.sql` | **Create** — new table + FK column |
| `apps/api/src/routes/categories.ts` | **Create** — CRUD for categories |
| `apps/api/src/routes/services.ts` | **Modify** — GET returns `{ categories, services }` shape |
| `apps/api/src/index.ts` | **Modify** — mount categories router |
| `apps/api/src/__tests__/categories.test.ts` | **Create** — unit tests |
| `services/whatsapp-agent/src/index.ts` | **Modify** — `sendCategoryList`, `category_<id>` handler, bypass logic |
| `apps/web/src/components/booking/booking-flow.tsx` | **Modify** — category-first step |
| `apps/web/src/app/[locale]/dashboard/settings/page.tsx` | **Modify** — new Services tab |
| `packages/i18n/messages/he.json` | **Modify** — new translation keys |
| `packages/i18n/messages/ar.json` | **Modify** — new translation keys |
| `packages/i18n/messages/en.json` | **Modify** — new translation keys |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/00018_service_categories.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/00018_service_categories.sql`:

```sql
-- New table for service categories
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

CREATE INDEX idx_service_categories_business_id ON service_categories(business_id);

-- Add nullable category_id to services
ALTER TABLE services
  ADD COLUMN category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL;

-- RLS: same pattern as services table
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can read categories"
  ON service_categories FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_staff WHERE user_id = auth.uid()
    )
    OR business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage categories"
  ON service_categories FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
cd /Users/adamazz1993/Desktop/torup && npx supabase db push
```
Expected: migration applied with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00018_service_categories.sql
git commit -m "feat: add service_categories table and category_id FK on services"
```

---

## Task 2: Categories API route

**Files:**
- Create: `apps/api/src/routes/categories.ts`
- Create: `apps/api/src/__tests__/categories.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/categories.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => ({ data: { id: "cat-1", name_he: "תסרוקות", name_ar: null, name_en: null, sort_order: 0, business_id: "biz-1" }, error: null }) }) }),
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: { id: "cat-1", name_he: "תסרוקות חדש", sort_order: 1, business_id: "biz-1" }, error: null }) }) }) }) }),
      delete: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }),
    }),
  }),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireBusinessAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: (..._roles: string[]) => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/params.js", () => ({
  getBusinessId: () => "biz-1",
  getParam: (_req: unknown, key: string) => key === "categoryId" ? "cat-1" : "",
}));

import express from "express";
import request from "supertest";
import categoriesRouter from "../routes/categories.js";

const app = express();
app.use(express.json());
app.use("/", categoriesRouter);

describe("Categories API", () => {
  it("GET / returns list", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST / creates category", async () => {
    const res = await request(app).post("/").send({ name_he: "תסרוקות" });
    expect(res.status).toBe(201);
    expect(res.body.name_he).toBe("תסרוקות");
  });

  it("PATCH /:categoryId updates category", async () => {
    const res = await request(app).patch("/cat-1").send({ name_he: "תסרוקות חדש" });
    expect(res.status).toBe(200);
    expect(res.body.name_he).toBe("תסרוקות חדש");
  });

  it("DELETE /:categoryId returns 204", async () => {
    const res = await request(app).delete("/cat-1");
    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && npx vitest run src/__tests__/categories.test.ts 2>&1 | tail -10
```
Expected: FAIL — `../routes/categories.js` not found.

- [ ] **Step 3: Create the categories router**

Create `apps/api/src/routes/categories.ts`:

```ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId, getParam } from "../lib/params.js";
import {
  requireAuth,
  requireRole,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router = Router({ mergeParams: true });

// GET /businesses/:businessId/categories
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("service_categories")
      .select("*")
      .eq("business_id", getBusinessId(req))
      .order("sort_order");
    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (err) { next(err); }
});

// POST /businesses/:businessId/categories
router.post(
  "/",
  requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { name_he, name_ar, name_en, sort_order } = req.body;
      if (!name_he) throw new AppError(400, "name_he is required");
      const { data, error } = await supabase
        .from("service_categories")
        .insert({ name_he, name_ar: name_ar || null, name_en: name_en || null, sort_order: sort_order ?? 0, business_id: getBusinessId(req) })
        .select()
        .single();
      if (error) throw new AppError(400, error.message);
      res.status(201).json(data);
    } catch (err) { next(err); }
  }
);

// PATCH /businesses/:businessId/categories/:categoryId
router.patch(
  "/:categoryId",
  requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("service_categories")
        .update(req.body)
        .eq("id", getParam(req, "categoryId"))
        .eq("business_id", getBusinessId(req))
        .select()
        .single();
      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) { next(err); }
  }
);

// DELETE /businesses/:businessId/categories/:categoryId
router.delete(
  "/:categoryId",
  requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("service_categories")
        .delete()
        .eq("id", getParam(req, "categoryId"))
        .eq("business_id", getBusinessId(req));
      if (error) throw new AppError(400, error.message);
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

export default router;
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/api && npx vitest run src/__tests__/categories.test.ts 2>&1 | tail -10
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Mount the router in index.ts**

In `apps/api/src/index.ts`, add after the services router line:

```ts
import categoriesRouter from "./routes/categories.js";
```

And after `app.use("/api/businesses/:businessId/services", servicesRouter);`:

```ts
app.use("/api/businesses/:businessId/categories", categoriesRouter);
```

- [ ] **Step 6: Update GET /services to return `{ categories, services }` shape**

In `apps/api/src/routes/services.ts`, replace the GET `/` handler:

```ts
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const businessId = getBusinessId(req);

    const [servicesResult, categoriesResult] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("service_categories")
        .select("*")
        .eq("business_id", businessId)
        .order("sort_order"),
    ]);

    if (servicesResult.error) throw new AppError(500, servicesResult.error.message);

    const categories = categoriesResult.data || [];
    const services = servicesResult.data || [];

    // If no categories exist, return flat array for backward compatibility
    if (categories.length === 0) {
      res.json(services);
      return;
    }

    res.json({ categories, services });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 7: Run type-check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/categories.ts apps/api/src/__tests__/categories.test.ts apps/api/src/routes/services.ts apps/api/src/index.ts
git commit -m "feat: categories CRUD API + enriched services GET response"
```

---

## Task 3: WhatsApp agent — category picker

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Add `sendCategoryList` helper**

In `services/whatsapp-agent/src/index.ts`, after `sendServiceList` function (around line 248), add:

```ts
const CATEGORY_LIST_I18N: Record<"he" | "ar" | "en", { prompt: string; button: string; section: string; more: string }> = {
  he: { prompt: "בחרו קטגוריה:", button: "הצג קטגוריות", section: "קטגוריות", more: "שירותים נוספים" },
  ar: { prompt: "اختاري الفئة:", button: "شوفي الفئات", section: "الفئات", more: "خدمات أخرى" },
  en: { prompt: "Choose a category:", button: "Show Categories", section: "Categories", more: "More services" },
};

async function sendCategoryList(
  phoneNumberId: string,
  to: string,
  categories: Array<{ id: string; name_he: string; name_ar: string | null; name_en: string | null }>,
  hasUncategorized: boolean,
  language: "he" | "ar" | "en" = "he"
) {
  const i18n = CATEGORY_LIST_I18N[language];
  const rows = categories.map((c) => ({
    id: `category_${c.id}`,
    title: (language === "ar" && c.name_ar ? c.name_ar : language === "en" && c.name_en ? c.name_en : c.name_he).slice(0, 24),
    description: "",
  }));
  if (hasUncategorized) {
    rows.push({ id: "category_uncategorized", title: i18n.more, description: "" });
  }
  await sendListMessage(phoneNumberId, to, i18n.prompt, i18n.button, [{ title: i18n.section, rows }]);
}
```

- [ ] **Step 2: Update `getCachedBusinessContext` to also cache categories**

Find `getCachedBusinessContext` and change the cache type and fetch to include categories:

```ts
// Cache business info + services + categories + booking rules (5 min TTL)
const bizCache = new Map<string, {
  biz: { businessId: string; businessName: string; phone: string; allowMultipleBookings: boolean };
  services: Record<string, any>[];
  categories: Array<{ id: string; name_he: string; name_ar: string | null; name_en: string | null; sort_order: number }>;
  maxFutureDays: number;
  expiresAt: number;
}>();

async function getCachedBusinessContext(businessPhoneNumberId: string) {
  const cached = bizCache.get(businessPhoneNumberId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const biz = await resolveBusinessId(businessPhoneNumberId);
  if (!biz) return null;

  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const [services, rulesResult, categoriesResult] = await Promise.all([
    getBusinessServices(biz.businessId),
    supabase
      .from("booking_rules")
      .select("max_future_days")
      .eq("business_id", biz.businessId)
      .single(),
    supabase
      .from("service_categories")
      .select("id, name_he, name_ar, name_en, sort_order")
      .eq("business_id", biz.businessId)
      .order("sort_order"),
  ]);

  const maxFutureDays = rulesResult.data?.max_future_days ?? 30;
  const categories = categoriesResult.data || [];
  const entry = { biz, services, categories, maxFutureDays, expiresAt: Date.now() + 5 * 60 * 1000 };
  bizCache.set(businessPhoneNumberId, entry);
  return entry;
}
```

- [ ] **Step 3: Add helper to check if category step is needed**

After `getCachedBusinessContext`, add:

```ts
function shouldShowCategories(
  categories: Array<{ id: string }>,
  services: Array<{ category_id?: string | null }>
): boolean {
  if (categories.length === 0) return false;
  return services.some((s) => s.category_id != null);
}
```

- [ ] **Step 4: Replace `sendServiceList` calls that show ALL services with category-aware dispatch**

In `handleIncomingMessage`, find the two places where `sendServiceList` is called for the full list (menu_book button and booking pattern):

Replace the `interactionId === "menu_book"` handler:

```ts
if (interactionId === "menu_book") {
  const lang = session.language ?? "he";
  if (shouldShowCategories(ctx.categories, ctx.services)) {
    const hasUncategorized = ctx.services.some((s: any) => !s.category_id);
    await sendCategoryList(businessPhoneNumberId, from, ctx.categories, hasUncategorized, lang);
  } else {
    await sendServiceList(businessPhoneNumberId, from, ctx.services, lang);
  }
  return;
}
```

Replace the booking pattern handler (the line `await sendServiceList(businessPhoneNumberId, from, ctx.services, session.language ?? "he")`):

```ts
  const lang = session.language ?? "he";
  if (shouldShowCategories(ctx.categories, ctx.services)) {
    const hasUncategorized = ctx.services.some((s: any) => !s.category_id);
    await sendCategoryList(businessPhoneNumberId, from, ctx.categories, hasUncategorized, lang);
  } else {
    await sendServiceList(businessPhoneNumberId, from, ctx.services, lang);
  }
  return;
```

- [ ] **Step 5: Add `category_<id>` interactionId handler**

In the `if (interactionId)` block, add BEFORE the `service_` handler:

```ts
    // Category selected → show services in that category
    if (interactionId.startsWith("category_")) {
      const categoryId = interactionId.replace("category_", "");
      const lang = session.language ?? "he";
      const filtered = categoryId === "uncategorized"
        ? ctx.services.filter((s: any) => !s.category_id)
        : ctx.services.filter((s: any) => s.category_id === categoryId);
      await sendServiceList(businessPhoneNumberId, from, filtered, lang);
      return;
    }
```

- [ ] **Step 6: Run type-check and tests**

```bash
cd services/whatsapp-agent && npx tsc --noEmit 2>&1 && npx vitest run 2>&1 | tail -10
```
Expected: no type errors, all 33 tests pass.

- [ ] **Step 7: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: WhatsApp category picker — two-step category → service flow"
```

---

## Task 4: Web booking page — category step

**Files:**
- Modify: `apps/web/src/components/booking/booking-flow.tsx`

- [ ] **Step 1: Add `ServiceCategory` interface and update `BookingFlow` props**

At the top of `apps/web/src/components/booking/booking-flow.tsx`, after the `Service` interface, add:

```ts
interface ServiceCategory {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
}
```

Update the `BookingFlow` props:

```ts
export function BookingFlow({
  business,
  services,
  categories,
  locale,
}: {
  business: Business;
  services: Service[];
  categories: ServiceCategory[];
  locale: string;
}) {
```

- [ ] **Step 2: Add category state**

Inside `BookingFlow`, after the existing `useState` declarations, add:

```ts
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
```

Also add a helper to determine if the category step is needed:

```ts
const hasCategories = categories.length > 0 && services.some((s: any) => s.category_id != null);
```

- [ ] **Step 3: Add `getCategoryName` helper**

After `getServiceName`, add:

```ts
function getCategoryName(cat: ServiceCategory, locale: string) {
  if (locale === "ar" && cat.name_ar) return cat.name_ar;
  if (locale === "en" && cat.name_en) return cat.name_en;
  return cat.name_he;
}
```

- [ ] **Step 4: Compute filtered services for step rendering**

Inside `BookingFlow`, before the return statement, add:

```ts
  const uncategorizedServices = services.filter((s: any) => !s.category_id);
  const categoryLabels: Record<"he" | "ar" | "en", string> = {
    he: "שירותים נוספים",
    ar: "خدمات أخرى",
    en: "More services",
  };
  const backToCategoriesLabel: Record<"he" | "ar" | "en", string> = {
    he: "← חזרה לקטגוריות",
    ar: "← العودة للفئات",
    en: "← Back to categories",
  };
  const chooseCategoryLabel: Record<"he" | "ar" | "en", string> = {
    he: "בחרו קטגוריה",
    ar: "اختاري الفئة",
    en: "Choose a category",
  };

  const servicesInView: Service[] = !hasCategories
    ? services
    : selectedCategory === "uncategorized"
      ? uncategorizedServices
      : selectedCategory
        ? services.filter((s: any) => s.category_id === selectedCategory)
        : [];
```

- [ ] **Step 5: Replace the service step JSX**

Find the `{step === "service" && (` block and replace it entirely:

```tsx
      {/* Step 1: Category (when categories exist) */}
      {step === "service" && hasCategories && selectedCategory === null && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {chooseCategoryLabel[locale as "he" | "ar" | "en"] ?? chooseCategoryLabel.he}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((cat) => {
              const servicesInCat = services.filter((s: any) => s.category_id === cat.id);
              if (servicesInCat.length === 0) return null;
              const countLabel = `${servicesInCat.length} ${locale === "ar" ? "خدمات" : locale === "en" ? "services" : "שירותים"}`;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="rounded-xl border-2 border-gray-100 bg-white p-4 text-start hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <p className="font-semibold text-gray-900">{getCategoryName(cat, locale)}</p>
                  <p className="text-xs text-gray-400 mt-1">{countLabel}</p>
                </button>
              );
            })}
            {uncategorizedServices.length > 0 && (
              <button
                onClick={() => setSelectedCategory("uncategorized")}
                className="rounded-xl border-2 border-gray-100 bg-white p-4 text-start hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <p className="font-semibold text-gray-900">
                  {categoryLabels[locale as "he" | "ar" | "en"] ?? categoryLabels.he}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {uncategorizedServices.length} {locale === "ar" ? "خدمات" : locale === "en" ? "services" : "שירותים"}
                </p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Service (flat list or after category selected) */}
      {step === "service" && (!hasCategories || selectedCategory !== null) && (
        <div>
          {hasCategories && selectedCategory !== null && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 mb-4 hover:bg-indigo-100 transition-colors"
            >
              {backToCategoriesLabel[locale as "he" | "ar" | "en"] ?? backToCategoriesLabel.he}
            </button>
          )}
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t("selectService")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
```

Then close the grid and div at the end of the original service step (the `})}` and `</div></div>`).

- [ ] **Step 6: Update the parent page that passes services to BookingFlow**

Find the booking page that renders `<BookingFlow>`. It's in `apps/web/src/app/[locale]/book/[slug]/page.tsx` or similar. Update it to fetch categories and pass them:

```bash
grep -rn "BookingFlow" /Users/adamazz1993/Desktop/torup/apps/web/src --include="*.tsx" | grep -v "booking-flow.tsx"
```

Read that file and update the data fetch to handle the `{ categories, services }` API response shape:

```ts
// In the parent page/component that fetches services:
const result = await apiFetch<Service[] | { categories: ServiceCategory[]; services: Service[] }>(
  `/api/businesses/${business.id}/services`
);
const services = Array.isArray(result) ? result : result.services;
const categories = Array.isArray(result) ? [] : (result.categories || []);
// Pass both to BookingFlow:
// <BookingFlow business={business} services={services} categories={categories} locale={locale} />
```

- [ ] **Step 7: Run type-check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "booking-flow\|categories" | head -10
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/booking/booking-flow.tsx
git commit -m "feat: web booking page — category-first two-step service picker"
```

---

## Task 5: Dashboard Services tab

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/settings/page.tsx`
- Modify: `packages/i18n/messages/he.json`
- Modify: `packages/i18n/messages/ar.json`
- Modify: `packages/i18n/messages/en.json`

- [ ] **Step 1: Add translation keys**

In `packages/i18n/messages/he.json`, inside `"dashboard"`:
```json
"services": "שירותים",
"serviceName": "שם השירות",
"serviceCategory": "קטגוריה",
"noCategory": "ללא קטגוריה",
"newCategory": "+ קטגוריה חדשה",
"categoryName": "שם קטגוריה",
"addService": "הוסף שירות",
"duration": "משך (דקות)",
"priceType": "סוג מחיר",
"priceTypeFixed": "מחיר קבוע",
"priceTypeDiscuss": "לדיון",
"moveUp": "העבר למעלה",
"moveDown": "העבר למטה"
```

In `packages/i18n/messages/ar.json`, inside `"dashboard"`:
```json
"services": "الخدمات",
"serviceName": "اسم الخدمة",
"serviceCategory": "الفئة",
"noCategory": "بدون فئة",
"newCategory": "+ فئة جديدة",
"categoryName": "اسم الفئة",
"addService": "أضف خدمة",
"duration": "المدة (دقائق)",
"priceType": "نوع السعر",
"priceTypeFixed": "سعر ثابت",
"priceTypeDiscuss": "للاتفاق",
"moveUp": "انقل للأعلى",
"moveDown": "انقل للأسفل"
```

In `packages/i18n/messages/en.json`, inside `"dashboard"`:
```json
"services": "Services",
"serviceName": "Service name",
"serviceCategory": "Category",
"noCategory": "No category",
"newCategory": "+ New category",
"categoryName": "Category name",
"addService": "Add service",
"duration": "Duration (min)",
"priceType": "Price type",
"priceTypeFixed": "Fixed price",
"priceTypeDiscuss": "Discuss",
"moveUp": "Move up",
"moveDown": "Move down"
```

- [ ] **Step 2: Add interfaces and state to settings page**

In `apps/web/src/app/[locale]/dashboard/settings/page.tsx`, add these interfaces near the top with the other interfaces:

```ts
interface Service {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  duration_minutes: number;
  price: number;
  price_type: string;
  sort_order: number;
  category_id: string | null;
}

interface ServiceCategory {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
}
```

Add to the `Tab` type:
```ts
type Tab = "hours" | "breaks" | "reminders" | "rules" | "staff" | "profile" | "booking" | "gcal" | "services";
```

Add state variables after the existing ones:
```ts
const [services, setServices] = useState<Service[]>([]);
const [categories, setCategories] = useState<ServiceCategory[]>([]);
const [newCategoryName, setNewCategoryName] = useState("");
const [showNewCategoryInput, setShowNewCategoryInput] = useState<string | null>(null); // serviceId that triggered it
const [editingService, setEditingService] = useState<string | null>(null);
const [serviceForm, setServiceForm] = useState<Partial<Service>>({});
```

- [ ] **Step 3: Add data fetching for services tab**

In the `useEffect` that fetches tab data (around line 174), add a branch for the services tab:

```ts
} else if (tab === "services") {
  const [svcResult, catResult] = await Promise.all([
    apiFetch<Service[] | { categories: ServiceCategory[]; services: Service[] }>(
      `/api/businesses/${id}/services`, {}, session.access_token
    ),
    apiFetch<ServiceCategory[]>(`/api/businesses/${id}/categories`, {}, session.access_token),
  ]);
  const svcList = Array.isArray(svcResult) ? svcResult : svcResult.services;
  setServices(svcList || []);
  setCategories(catResult || []);
}
```

- [ ] **Step 4: Add the Services tab to the tabs array**

Find the `tabs` array and add:
```ts
{ key: "services", label: t("services") },
```

- [ ] **Step 5: Add the Services tab render**

In the settings page JSX, after the last `{tab === "gcal" && ...}` block, add:

```tsx
{tab === "services" && (
  <div className="space-y-6">
    {/* Grouped by category */}
    {[
      ...categories.map((cat) => ({
        catId: cat.id,
        label: cat.name_he,
        items: services.filter((s) => s.category_id === cat.id),
      })),
      {
        catId: null,
        label: t("noCategory"),
        items: services.filter((s) => !s.category_id),
      },
    ]
      .filter((group) => group.items.length > 0 || group.catId === null)
      .map((group) => (
        <div key={group.catId ?? "uncategorized"}>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              {group.label}
            </h3>
            {group.catId && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 text-xs"
                  onClick={async () => {
                    const cat = categories.find((c) => c.id === group.catId);
                    if (!cat) return;
                    const newOrder = Math.max(0, cat.sort_order - 1);
                    await apiFetch(`/api/businesses/${businessId}/categories/${cat.id}`, {
                      method: "PATCH", body: JSON.stringify({ sort_order: newOrder }),
                    }, session?.access_token);
                    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, sort_order: newOrder } : c).sort((a, b) => a.sort_order - b.sort_order));
                  }}
                >▲</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 text-xs"
                  onClick={async () => {
                    const cat = categories.find((c) => c.id === group.catId);
                    if (!cat) return;
                    const newOrder = cat.sort_order + 1;
                    await apiFetch(`/api/businesses/${businessId}/categories/${cat.id}`, {
                      method: "PATCH", body: JSON.stringify({ sort_order: newOrder }),
                    }, session?.access_token);
                    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, sort_order: newOrder } : c).sort((a, b) => a.sort_order - b.sort_order));
                  }}
                >▼</Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {group.items.map((svc) => (
              <Card key={svc.id}>
                <CardContent className="p-4">
                  {editingService === svc.id ? (
                    <div className="space-y-3">
                      <Input
                        value={serviceForm.name_he ?? svc.name_he}
                        onChange={(e) => setServiceForm((f) => ({ ...f, name_he: e.target.value }))}
                        placeholder={t("serviceName") + " (HE)"}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          value={serviceForm.duration_minutes ?? svc.duration_minutes}
                          onChange={(e) => setServiceForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                          placeholder={t("duration")}
                        />
                        <Input
                          type="number"
                          value={serviceForm.price ?? svc.price}
                          onChange={(e) => setServiceForm((f) => ({ ...f, price: Number(e.target.value) }))}
                          placeholder={t("price")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t("serviceCategory")}</Label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={serviceForm.category_id ?? svc.category_id ?? ""}
                          onChange={async (e) => {
                            const val = e.target.value;
                            if (val === "__new__") {
                              setShowNewCategoryInput(svc.id);
                              return;
                            }
                            setServiceForm((f) => ({ ...f, category_id: val || null }));
                          }}
                        >
                          <option value="">{t("noCategory")}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name_he}</option>
                          ))}
                          <option value="__new__">{t("newCategory")}</option>
                        </select>
                        {showNewCategoryInput === svc.id && (
                          <div className="flex gap-2 mt-2">
                            <Input
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              placeholder={t("categoryName")}
                              className="text-sm"
                            />
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (!newCategoryName.trim()) return;
                                const created = await apiFetch<ServiceCategory>(
                                  `/api/businesses/${businessId}/categories`,
                                  { method: "POST", body: JSON.stringify({ name_he: newCategoryName, sort_order: categories.length }) },
                                  session?.access_token
                                );
                                setCategories((prev) => [...prev, created]);
                                setServiceForm((f) => ({ ...f, category_id: created.id }));
                                setNewCategoryName("");
                                setShowNewCategoryInput(null);
                              }}
                            >{tCommon("save")}</Button>
                            <Button size="sm" variant="outline" onClick={() => setShowNewCategoryInput(null)}>{tCommon("cancel")}</Button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const updated = await apiFetch<Service>(
                              `/api/businesses/${businessId}/services/${svc.id}`,
                              { method: "PATCH", body: JSON.stringify(serviceForm) },
                              session?.access_token
                            );
                            setServices((prev) => prev.map((s) => s.id === updated.id ? updated : s));
                            setEditingService(null);
                            setServiceForm({});
                          }}
                        >{tCommon("save")}</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingService(null); setServiceForm({}); }}>{tCommon("cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{svc.name_he}</p>
                        <p className="text-xs text-muted-foreground">{svc.duration_minutes} {t("min")} • ₪{svc.price}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingService(svc.id); setServiceForm({}); }}
                      >{tCommon("edit")}</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
  </div>
)}
```

- [ ] **Step 6: Run type-check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "settings\|services\|categories" | head -20
```
Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd /Users/adamazz1993/Desktop/torup && pnpm turbo test 2>&1 | tail -15
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/[locale]/dashboard/settings/page.tsx" packages/i18n/messages/
git commit -m "feat: dashboard Services tab with inline category assignment"
```

---

## Verification

1. **Apply migration:** `npx supabase db push` — verify `service_categories` table exists.

2. **Create categories via API:**
```bash
curl -X POST http://localhost:3001/api/businesses/<id>/categories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name_he":"תסרוקות","name_ar":"تسريحات","name_en":"Hairstyles"}'
```

3. **Assign service to category:**
```bash
curl -X PATCH http://localhost:3001/api/businesses/<id>/services/<service-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"category_id":"<category-id>"}'
```

4. **WhatsApp:** Send "بدي دور" — should see category list first, then filtered services.

5. **Web booking:** Go to `/book/<slug>` — should see category cards first.

6. **Dashboard Settings → Services tab:** Click Edit on a service → Category dropdown shows existing categories + "＋ קטגוריה חדשה" option.

---

## Self-Review

- **Spec coverage:** DB migration ✓, categories CRUD API ✓, enriched services GET ✓, WhatsApp two-step ✓, web booking two-step ✓, dashboard Services tab ✓, category reordering ✓, bypass rules ✓, `ON DELETE SET NULL` ✓
- **Backward compatibility:** GET /services returns flat array when no categories exist — existing clients unaffected ✓
- **Type consistency:** `ServiceCategory` defined once in Task 4 and Task 5 independently (different packages, no shared type needed) ✓
- **No placeholders:** All code blocks are complete ✓
