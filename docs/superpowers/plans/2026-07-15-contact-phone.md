# Contact Phone Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `contact_phone` field to businesses so the cancel redirect WhatsApp link uses a different number than the manager approval notifications number.

**Architecture:** Add a nullable `contact_phone` DB column, extend the Zod schema, surface it in admin and dashboard settings UIs, and update the whatsapp-agent to use `contactPhone ?? phone` for the cancel redirect.

**Tech Stack:** TypeScript, Supabase (PostgreSQL), Next.js, React, Zod, Vitest

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/00025_add_contact_phone.sql` | Create — adds nullable column |
| `packages/shared/src/schemas/business.ts` | Add `contact_phone` to `businessSchema` and `updateBusinessSchema` |
| `apps/web/src/app/[locale]/dashboard/settings/page.tsx` | Add field to `BusinessProfile` interface, `saveProfile` payload, and profile tab UI |
| `apps/web/src/app/[locale]/admin/page.tsx` | Add field to `formData` state, `handleSaveEdit` payload, onboard dialog, and edit dialog |
| `services/whatsapp-agent/src/index.ts` | Add `contactPhone` to biz cache type, DB select, and fallback logic in cancel handlers |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/00025_add_contact_phone.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/00025_add_contact_phone.sql
ALTER TABLE businesses ADD COLUMN contact_phone TEXT;
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd /Users/adamazz1993/Desktop/torup
npx supabase db push
```

Expected: migration applied without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00025_add_contact_phone.sql
git commit -m "feat: add contact_phone column to businesses table"
```

---

## Task 2: Extend shared Zod schema

**Files:**
- Modify: `packages/shared/src/schemas/business.ts`

- [ ] **Step 1: Add `contact_phone` to `businessSchema`**

The current `businessSchema` ends at line ~20 with `updated_at`. Add `contact_phone` after the `phone` field:

```typescript
export const businessSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(2).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  logo_url: z.string().url().nullable(),
  cover_url: z.string().url().nullable(),
  category: z.string().min(1).max(100),
  phone: z.string().min(9).max(20),
  contact_phone: z.string().min(9).max(20).nullable(),
  email: z.string().email(),
  address: z.string().max(500).nullable(),
  social_links: z.record(z.string()).nullable(),
  default_language: z.enum(SUPPORTED_LANGUAGES),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

`updateBusinessSchema` is `createBusinessSchema.partial()` which is derived automatically — no further changes needed.

- [ ] **Step 2: Run type-check**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo type-check --filter=@torup/shared
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas/business.ts
git commit -m "feat: add contact_phone to business schema"
```

---

## Task 3: Dashboard settings UI

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/settings/page.tsx`

- [ ] **Step 1: Add `contact_phone` to the `BusinessProfile` interface (line 55)**

Replace:
```typescript
interface BusinessProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bot_context: string | null;
}
```

With:
```typescript
interface BusinessProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  contact_phone: string | null;
  email: string | null;
  address: string | null;
  bot_context: string | null;
}
```

- [ ] **Step 2: Add `contact_phone` to the `saveProfile` payload (line ~349)**

Replace:
```typescript
body: JSON.stringify({ name: profile.name, description: profile.description, phone: profile.phone, email: profile.email, address: profile.address, bot_context: profile.bot_context }),
```

With:
```typescript
body: JSON.stringify({ name: profile.name, description: profile.description, phone: profile.phone, contact_phone: profile.contact_phone, email: profile.email, address: profile.address, bot_context: profile.bot_context }),
```

- [ ] **Step 3: Add contact phone input to the profile tab UI (after the phone field, around line 880)**

After:
```tsx
            <div>
              <label className="block text-sm font-medium mb-1">{t("phone")}</label>
              <input value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} dir="ltr"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
```

Add:
```tsx
            <div>
              <label className="block text-sm font-medium mb-1">{t("contactPhone")}</label>
              <p className="text-xs text-muted-foreground mb-1">{t("contactPhoneDesc")}</p>
              <input value={profile.contact_phone || ""} onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })} dir="ltr"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
```

- [ ] **Step 4: Add translation keys**

Find the settings translations file. It will be at a path like:
`apps/web/src/i18n/messages/he.json` or similar.

Search for the `"phone"` key under the settings namespace and add alongside it:
```json
"contactPhone": "טלפון ליצירת קשר",
"contactPhoneDesc": "מספר זה ישמש ללקוחות המבקשים לבטל תור. אם ריק, ישתמש בטלפון הראשי."
```

And for the `en` locale:
```json
"contactPhone": "Contact Phone",
"contactPhoneDesc": "Customers who want to cancel will be directed to this number. Falls back to main phone if empty."
```

- [ ] **Step 5: Run type-check**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo type-check --filter=web
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/[locale]/dashboard/settings/page.tsx
git add apps/web/src/i18n/  # or wherever locale files live
git commit -m "feat: add contact phone field to dashboard settings"
```

---

## Task 4: Admin panel UI

**Files:**
- Modify: `apps/web/src/app/[locale]/admin/page.tsx`

- [ ] **Step 1: Add `contact_phone` to the `formData` initial state (line 67)**

Replace:
```typescript
  const [formData, setFormData] = useState({
    name: "", slug: "", category: "", phone: "", email: "", address: "", plan_id: "", owner_email: "",
  });
```

With:
```typescript
  const [formData, setFormData] = useState({
    name: "", slug: "", category: "", phone: "", contact_phone: "", email: "", address: "", plan_id: "", owner_email: "",
  });
```

- [ ] **Step 2: Add `contact_phone` to the onboard dialog UI (after the phone input, around line 356)**

After:
```tsx
              <div className="space-y-2">
                <Label>{tCommon("phone") || "Phone"}</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr" />
              </div>
```

Add (inside the same `grid grid-cols-2` or as a new row below):
```tsx
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} dir="ltr" placeholder="Optional" />
            </div>
```

- [ ] **Step 3: Add `contact_phone` to the edit dialog UI (after the phone input, around line 420)**

After:
```tsx
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editBusiness?.phone || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, phone: e.target.value })} dir="ltr" />
              </div>
```

Add:
```tsx
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={(editBusiness as any)?.contact_phone || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, contact_phone: e.target.value } as any)} dir="ltr" placeholder="Optional" />
              </div>
```

Note: `Business` type from `@torup/shared` will have `contact_phone` after Task 2 is merged; if not yet rebuilt use `as any` temporarily.

- [ ] **Step 4: Add `contact_phone` to `handleSaveEdit` payload (around line 173)**

Replace:
```typescript
          name: editBusiness.name,
          slug: editBusiness.slug,
          category: editBusiness.category,
          phone: editBusiness.phone,
          email: editBusiness.email,
          address: editBusiness.address,
```

With:
```typescript
          name: editBusiness.name,
          slug: editBusiness.slug,
          category: editBusiness.category,
          phone: editBusiness.phone,
          contact_phone: (editBusiness as any).contact_phone || null,
          email: editBusiness.email,
          address: editBusiness.address,
```

- [ ] **Step 5: Run type-check**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo type-check --filter=web
```

Expected: no errors (or only the temporary `as any` which is acceptable).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/[locale]/admin/page.tsx"
git commit -m "feat: add contact phone field to admin panel"
```

---

## Task 5: WhatsApp agent — use contact_phone for cancel redirect

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Add `contactPhone` to the biz cache type and `resolveBusinessId` return type (around line 103)**

Find the `resolveBusinessId` return type annotation:
```typescript
async function resolveBusinessId(phoneNumberId: string): Promise<{ businessId: string; businessName: string; phone: string; allowMultipleBookings: boolean; botContext: string | null } | null>
```

Replace with:
```typescript
async function resolveBusinessId(phoneNumberId: string): Promise<{ businessId: string; businessName: string; phone: string; contactPhone: string | null; allowMultipleBookings: boolean; botContext: string | null } | null>
```

- [ ] **Step 2: Add `contact_phone` to the DB select in `resolveBusinessId` (around line 121)**

Replace:
```typescript
    .select("id, name, phone, allow_multiple_bookings, bot_context")
```

With:
```typescript
    .select("id, name, phone, contact_phone, allow_multiple_bookings, bot_context")
```

- [ ] **Step 3: Map `contact_phone` in the return value of `resolveBusinessId` (around line 126)**

Replace:
```typescript
  if (data) return { businessId: data.id, businessName: data.name, phone: data.phone, allowMultipleBookings: data.allow_multiple_bookings, botContext: data.bot_context ?? null };
```

With:
```typescript
  if (data) return { businessId: data.id, businessName: data.name, phone: data.phone, contactPhone: data.contact_phone ?? null, allowMultipleBookings: data.allow_multiple_bookings, botContext: data.bot_context ?? null };
```

- [ ] **Step 4: Update the `bizCache` map type (around line 147)**

Find:
```typescript
const bizCache = new Map<string, { biz: { businessId: string; businessName: string; phone: string; allowMultipleBookings: boolean; botContext: string | null }; ...
```

Add `contactPhone: string | null` to the biz object type inside the Map generic.

- [ ] **Step 5: Update the PHONE_BUSINESS_MAP branch to include contactPhone**

In `resolveBusinessId`, the first branch reads from `process.env.PHONE_BUSINESS_MAP`. Since that map is env-configured (not DB), set `contactPhone: null` for the map branch:

Find:
```typescript
      if (map[phoneNumberId]) return map[phoneNumberId];
```

The map values are typed by the return type — after the return type change in Step 1, TypeScript will require `contactPhone` in the map. Since env-map entries won't have it, change to:

```typescript
      if (map[phoneNumberId]) return { contactPhone: null, ...map[phoneNumberId] };
```

- [ ] **Step 6: Replace all `ctx.biz.phone` cancel-redirect usages with fallback**

There are 3 places that compute `managerPhone` for the cancel redirect:

**Location 1 — `menu_cancel` handler (around line 1141):**
```typescript
// Before:
const managerPhone = ctx.biz.phone.replace(/[^0-9]/g, "");
// After:
const managerPhone = (ctx.biz.contactPhone ?? ctx.biz.phone).replace(/[^0-9]/g, "");
```

**Location 2 — `menu_my_appointments` processMessage call (around line 1160):**
```typescript
// Before:
managerPhone: ctx.biz.phone.replace(/[^0-9]/g, ""),
// After:
managerPhone: (ctx.biz.contactPhone ?? ctx.biz.phone).replace(/[^0-9]/g, ""),
```

**Location 3 — free-text processMessage call (around line 1456):**
```typescript
// Before:
managerPhone: ctx.biz.phone.replace(/[^0-9]/g, ""),
// After:
managerPhone: (ctx.biz.contactPhone ?? ctx.biz.phone).replace(/[^0-9]/g, ""),
```

- [ ] **Step 7: Run type-check and tests**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo type-check test --filter=whatsapp-agent
```

Expected: no type errors, 45 tests pass.

- [ ] **Step 8: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: use contact_phone for cancel redirect with fallback to phone"
```

---

## Task 6: Final build check and push

- [ ] **Step 1: Run full lint + type-check + test + build**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo lint type-check test build
```

Expected: all green.

- [ ] **Step 2: Push**

```bash
git push
```

Railway auto-deploys the API and whatsapp-agent from GitHub. Vercel deploys the web app.
