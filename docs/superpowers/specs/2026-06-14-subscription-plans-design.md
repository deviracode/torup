# Subscription Plans — Data Model, Enforcement & Admin UI

## Goal

Define subscription plan tiers with WhatsApp bot and AI bot feature gates, enforce those limits across the API, and enhance the super admin plans page to manage all plan attributes. Payment integration is out of scope — plans are assigned without charging for now.

## Scope

Sub-project (a) of onboarding + billing. Covers:
1. Database schema changes
2. Four seeded plan tiers
3. Server-side enforcement utility + middleware
4. Super admin plans UI enhancement

---

## Database

### Migration: `00023_subscription_plans_features.sql`

```sql
-- Add feature-gate columns to plans
ALTER TABLE plans
  ADD COLUMN has_whatsapp_bot      BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN has_ai_bot            BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN max_ai_tokens_monthly INTEGER  NOT NULL DEFAULT 0;

-- Token usage tracking (per business per calendar month)
CREATE TABLE ai_token_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month         DATE NOT NULL, -- first day of the month, e.g. 2026-06-01
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(business_id, month)
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on ai_token_usage"
  ON ai_token_usage FOR ALL
  USING (false); -- API uses service role key, bypasses RLS
```

### Seeded Plans

Inserted once by the migration (use `ON CONFLICT (name) DO NOTHING` to be idempotent):

| name | monthly_price | max_staff | has_whatsapp_bot | has_ai_bot | max_ai_tokens_monthly | max_appointments_monthly |
|------|--------------|-----------|-----------------|------------|----------------------|--------------------------|
| Basic | 100 | 3 | false | false | 0 | NULL |
| WhatsApp | 150 | 3 | true | false | 0 | NULL |
| AI | 200 | 3 | true | true | 2400000 | NULL |
| Unlimited | 300 | NULL | true | true | 2400000 | NULL |

`max_staff = NULL` → no staff limit. `max_appointments_monthly = NULL` → no appointment limit. `yearly_price = NULL` for all seeded plans (add later when billing is implemented).

### Subscription lifecycle (no payment yet)

A `subscriptions` row is created when a business owner selects a plan during onboarding (status = `'active'`). No `payplus_subscription_id` yet. If no active subscription row exists for a business, all dashboard API routes return 403.

---

## Enforcement

### Utility: `apps/api/src/lib/plan-limits.ts`

```typescript
export interface PlanLimits {
  maxStaff: number | null;           // null = unlimited
  maxAppointmentsMonthly: number | null;
  hasWhatsappBot: boolean;
  hasAiBot: boolean;
  maxAiTokensMonthly: number;
}

export async function getPlanLimits(businessId: string): Promise<PlanLimits | null>
// Returns null if no active subscription exists
```

Single Supabase query: join `subscriptions` → `plans` where `business_id = $1` and `status = 'active'`.

### Middleware: `requireSubscription`

Added to `apps/api/src/middleware/auth.ts` (or a new file). Applied to all `/businesses/:id/*` routes.

- Calls `getPlanLimits(businessId)`
- If `null` → 403 `{ error: "no_active_subscription" }`
- Attaches `planLimits` to `req` for downstream route handlers

### Three enforcement points

**1. Staff limit** — `POST /businesses/:id/staff`

Before inserting:
1. Count current staff via `business_members` for this business
2. If `planLimits.maxStaff !== null && count >= planLimits.maxStaff` → 403 `{ error: "staff_limit_reached", limit: planLimits.maxStaff }`

**2. WhatsApp bot** — `PATCH /businesses/:id/settings` (when saving WhatsApp phone number ID / token)

- If `!planLimits.hasWhatsappBot` → 403 `{ error: "whatsapp_not_in_plan" }`

**3. AI bot** — `PATCH /businesses/:id/settings` (when enabling Claude bot) + before each bot response

- Enabling: if `!planLimits.hasAiBot` → 403 `{ error: "ai_bot_not_in_plan" }`
- Token check: query `ai_token_usage` for current month; if `tokens_used >= maxAiTokensMonthly` → 403 `{ error: "ai_token_limit_reached" }`
- After each bot response: `INSERT INTO ai_token_usage ... ON CONFLICT DO UPDATE SET tokens_used = tokens_used + $delta`

---

## Super Admin Plans UI

### File: `apps/web/src/app/[locale]/admin/plans/page.tsx`

Migrate from raw HTML to shadcn components. Follow the frontend-design skill: use `Card`, `Dialog`, `Input`, `Label`, `Switch`, `Badge`, `Button` from shadcn/ui.

### Plan card (grid, 3 columns)

Each card shows:
- Plan name (`CardHeader`, `CardTitle`)
- Monthly price (`CardContent` row)
- Max staff — "Unlimited" if null
- Max appointments — "Unlimited" if null
- WhatsApp Bot — `Badge` variant `default` (green) if true, `secondary` (gray) if false
- AI Bot — same badge pattern
- AI Tokens/mo — shown only when `has_ai_bot = true`, formatted as "2.4M"
- Status — `Badge` "Active" / "Inactive"
- Edit button — `Button` variant `outline` opens the dialog

### Create/Edit dialog (shadcn `Dialog`)

Fields:
- Plan name — `Input`
- Monthly price (₪) — `Input` type number
- Yearly price (₪) — `Input` type number, optional
- Max staff — `Input` type number, placeholder "Unlimited (leave blank)"
- Max appointments/month — `Input` type number, placeholder "Unlimited (leave blank)"
- WhatsApp Bot — `Switch` + `Label`
- AI Bot — `Switch` + `Label`
- AI tokens/month — `Input` type number, disabled and auto-set to 2,400,000 when AI bot switch is on, 0 when off. Shows helper text: "≈ 2,000 conversations/month"
- Active — `Switch` + `Label`

Footer: `Button` "Save" (default) + `Button` "Cancel" (ghost).

### New Plan button

`Button` variant `default` in the page header: "New Plan" with `Plus` Lucide icon.

### API routes (existing, extend)

`GET/POST/PATCH/DELETE /api/admin/plans` — add `has_whatsapp_bot`, `has_ai_bot`, `max_ai_tokens_monthly` to request/response body. Validation: if `has_ai_bot = true` and `max_ai_tokens_monthly = 0`, auto-set to 2,400,000.

---

## Shared: Upgrade Modal

### File: `apps/web/src/components/dashboard/upgrade-modal.tsx`

A shadcn `Dialog` shown anywhere a plan limit is hit on the web side.

Props: `open`, `onClose`, `reason: "staff_limit" | "whatsapp_not_in_plan" | "ai_bot_not_in_plan" | "ai_token_limit" | "no_active_subscription"`

Content per reason:
- `staff_limit` — "You've reached your staff limit (3). Upgrade to Unlimited for more."
- `whatsapp_not_in_plan` — "WhatsApp bot is not included in your current plan."
- `ai_bot_not_in_plan` — "The AI bot is available on the AI plan (200 ₪/month)."
- `ai_token_limit` — "You've used all your AI tokens for this month."
- `no_active_subscription` — "Please select a plan to continue."

Footer: `Button` "View Plans" → `/dashboard/billing` + `Button` "Maybe Later" (ghost, closes modal).

The upgrade modal is triggered by catching 403 errors with these error codes in the web API client (`apiFetch`).

---

## Error Handling

- All 403 plan-enforcement errors include a machine-readable `error` string (listed above)
- `apiFetch` in the web client already throws on non-2xx — wrap call sites that might hit plan limits with a try/catch that checks `error.code` and opens the upgrade modal
- Token usage increment failures are non-fatal — log and continue (don't block the bot response)

---

## Out of Scope

- Payment processing (PayPlus integration) — next sub-project
- Onboarding wizard (plan selection UI during signup) — next sub-project after payment
- Appointment limit enforcement — schema supports it but no enforcement point built yet
- Yearly pricing — seeded as NULL, configurable via admin UI when billing is implemented
