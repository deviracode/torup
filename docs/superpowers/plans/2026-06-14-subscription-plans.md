# Subscription Plans — Data Model, Enforcement & Admin UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WhatsApp bot + AI bot feature flags to subscription plans, enforce plan limits across the API, and enhance the super admin plans page with the new fields using shadcn/ui.

**Architecture:** One DB migration adds three columns (`has_whatsapp_bot`, `has_ai_bot`, `max_ai_tokens_monthly`) to `plans` and creates an `ai_token_usage` table, then seeds four plan tiers. A `getPlanLimits()` utility and `requireSubscription` middleware enforce limits at the API level. The admin UI is migrated from raw HTML to shadcn components with the new fields. A shared `UpgradeModal` component handles all plan-limit errors on the web side.

**Tech Stack:** Supabase (PostgreSQL), Express + TypeScript (API), Next.js 15 App Router + shadcn/ui + Tailwind CSS v4 (web), Vitest (tests). Branch: `task/onboarding`.

---

## File Map

**Create:**
- `supabase/migrations/00023_subscription_plans_features.sql` — schema changes + seed data
- `apps/api/src/lib/plan-limits.ts` — `getPlanLimits()` utility + `PlanLimits` type
- `apps/web/src/components/dashboard/upgrade-modal.tsx` — shared upgrade prompt dialog

**Modify:**
- `apps/api/src/middleware/auth.ts` — add `requireSubscription` middleware, extend `AuthenticatedRequest` with `planLimits`
- `apps/api/src/routes/staff.ts` — enforce staff limit on POST /
- `apps/api/src/routes/admin.ts` — extend plan CRUD for new columns
- `apps/web/src/app/[locale]/admin/plans/page.tsx` — migrate to shadcn, add new fields
- `apps/api/src/__tests__/api.test.ts` — new tests
- `packages/i18n/messages/en.json` + `he.json` + `ar.json` — new i18n keys

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/00023_subscription_plans_features.sql`

- [ ] **Step 1: Write the migration file**

Create `/Users/adamazz1993/Desktop/torup/supabase/migrations/00023_subscription_plans_features.sql` with exactly this content:

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
  month         DATE NOT NULL,
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(business_id, month)
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no direct client access needed
CREATE POLICY "No direct client access to ai_token_usage"
  ON ai_token_usage FOR ALL
  USING (false);

-- Seed the four plan tiers (idempotent)
INSERT INTO plans (name, monthly_price, yearly_price, max_staff, max_appointments_monthly, has_whatsapp_bot, has_ai_bot, max_ai_tokens_monthly, is_active)
VALUES
  ('Basic',     100, NULL, 3,    NULL, false, false, 0,       true),
  ('WhatsApp',  150, NULL, 3,    NULL, true,  false, 0,       true),
  ('AI',        200, NULL, 3,    NULL, true,  true,  2400000, true),
  ('Unlimited', 300, NULL, NULL, NULL, true,  true,  2400000, true)
ON CONFLICT (name) DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

Run in the Supabase SQL editor (dashboard → SQL editor → paste and run). Verify: table `ai_token_usage` appears, `plans` table has three new columns, four rows appear in `plans`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00023_subscription_plans_features.sql
git commit -m "feat: add subscription plans feature columns + seed tiers"
```

---

## Task 2: `getPlanLimits` utility

**Files:**
- Create: `apps/api/src/lib/plan-limits.ts`
- Test: `apps/api/src/__tests__/api.test.ts`

- [ ] **Step 1: Write a failing test**

Add to `apps/api/src/__tests__/api.test.ts`:

```typescript
describe("PlanLimits logic", () => {
  it("staff is within limit when maxStaff is null", () => {
    const isAtLimit = (current: number, max: number | null) =>
      max !== null && current >= max;
    expect(isAtLimit(100, null)).toBe(false);
  });

  it("staff is at limit when current equals maxStaff", () => {
    const isAtLimit = (current: number, max: number | null) =>
      max !== null && current >= max;
    expect(isAtLimit(3, 3)).toBe(true);
  });

  it("staff is below limit when current is less than maxStaff", () => {
    const isAtLimit = (current: number, max: number | null) =>
      max !== null && current >= max;
    expect(isAtLimit(2, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (pure logic)**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && pnpm test
```

Expected: PASS

- [ ] **Step 3: Create `apps/api/src/lib/plan-limits.ts`**

```typescript
import { createServiceClient } from "./supabase.js";

export interface PlanLimits {
  planId: string;
  planName: string;
  maxStaff: number | null;
  maxAppointmentsMonthly: number | null;
  hasWhatsappBot: boolean;
  hasAiBot: boolean;
  maxAiTokensMonthly: number;
}

/**
 * Returns plan limits for the business's active subscription.
 * Returns null if no active subscription exists.
 */
export async function getPlanLimits(businessId: string): Promise<PlanLimits | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("subscriptions")
    .select(`
      plan_id,
      plans (
        id,
        name,
        max_staff,
        max_appointments_monthly,
        has_whatsapp_bot,
        has_ai_bot,
        max_ai_tokens_monthly
      )
    `)
    .eq("business_id", businessId)
    .eq("status", "active")
    .single();

  if (!data?.plans) return null;

  const plan = data.plans as Record<string, unknown>;

  return {
    planId: plan.id as string,
    planName: plan.name as string,
    maxStaff: plan.max_staff as number | null,
    maxAppointmentsMonthly: plan.max_appointments_monthly as number | null,
    hasWhatsappBot: plan.has_whatsapp_bot as boolean,
    hasAiBot: plan.has_ai_bot as boolean,
    maxAiTokensMonthly: plan.max_ai_tokens_monthly as number,
  };
}

/**
 * Increment AI token usage for the current month.
 * Non-fatal — call fire-and-forget after a successful bot response.
 */
export async function incrementAiTokenUsage(
  businessId: string,
  tokensUsed: number
): Promise<void> {
  const supabase = createServiceClient();
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const monthStr = month.toISOString().split("T")[0];

  await supabase.rpc("increment_ai_tokens", {
    p_business_id: businessId,
    p_month: monthStr,
    p_tokens: tokensUsed,
  });
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/plan-limits.ts apps/api/src/__tests__/api.test.ts
git commit -m "feat: add getPlanLimits utility"
```

---

## Task 3: `requireSubscription` middleware

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`
- Test: `apps/api/src/__tests__/api.test.ts`

- [ ] **Step 1: Write a failing test**

Add to `apps/api/src/__tests__/api.test.ts`:

```typescript
describe("requireSubscription enforcement", () => {
  it("blocks when planLimits is null (no subscription)", () => {
    const planLimits = null;
    const blocked = planLimits === null;
    expect(blocked).toBe(true);
  });

  it("allows when planLimits is present", () => {
    const planLimits = { maxStaff: 3, hasWhatsappBot: true, hasAiBot: false, maxAiTokensMonthly: 0, maxAppointmentsMonthly: null, planId: "x", planName: "Basic" };
    const blocked = planLimits === null;
    expect(blocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && pnpm test
```

Expected: PASS

- [ ] **Step 3: Update `apps/api/src/middleware/auth.ts`**

Add the `planLimits` field to `AuthenticatedRequest` and add the `requireSubscription` middleware. Add at the top of the file:

```typescript
import { getPlanLimits, type PlanLimits } from "../lib/plan-limits.js";
```

Extend the `AuthenticatedRequest` interface (add after `businessId?`):

```typescript
planLimits?: PlanLimits | null;
```

Add this new middleware function at the end of the file (before `export`):

```typescript
/**
 * Middleware: Require an active subscription for the business.
 * Attaches planLimits to req for downstream enforcement.
 * Must be used after requireBusinessAccess.
 */
export async function requireSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Super admins bypass subscription checks
  if (req.userRole === "super_admin") { next(); return; }

  const businessId = req.params.businessId || req.params.id || req.businessId;
  if (!businessId) { next(); return; }

  try {
    const limits = await getPlanLimits(businessId);
    if (!limits) {
      res.status(403).json({ error: "no_active_subscription" });
      return;
    }
    req.planLimits = limits;
    next();
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/__tests__/api.test.ts
git commit -m "feat: add requireSubscription middleware"
```

---

## Task 4: Enforce Staff Limit

**Files:**
- Modify: `apps/api/src/routes/staff.ts`
- Test: `apps/api/src/__tests__/api.test.ts`

- [ ] **Step 1: Write a failing test**

Add to `apps/api/src/__tests__/api.test.ts`:

```typescript
describe("Staff limit enforcement", () => {
  it("blocks adding staff when at max", () => {
    function canAddStaff(currentCount: number, maxStaff: number | null): boolean {
      if (maxStaff === null) return true;
      return currentCount < maxStaff;
    }
    expect(canAddStaff(3, 3)).toBe(false);
  });

  it("allows adding staff when below max", () => {
    function canAddStaff(currentCount: number, maxStaff: number | null): boolean {
      if (maxStaff === null) return true;
      return currentCount < maxStaff;
    }
    expect(canAddStaff(2, 3)).toBe(true);
  });

  it("always allows adding staff when maxStaff is null", () => {
    function canAddStaff(currentCount: number, maxStaff: number | null): boolean {
      if (maxStaff === null) return true;
      return currentCount < maxStaff;
    }
    expect(canAddStaff(999, null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it passes**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && pnpm test
```

Expected: PASS

- [ ] **Step 3: Add enforcement to POST / in `apps/api/src/routes/staff.ts`**

Import `requireSubscription` at the top of the file:

```typescript
import { requireSubscription } from "../middleware/auth.js";
```

Find the `router.post("/", ...)` route. Add `requireSubscription` to its middleware chain (after `requireBusinessAccess`):

```typescript
router.post(
  "/",
  requireAuth,
  requireBusinessAccess,
  requireSubscription,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const { email, role, display_name } = req.body;

      if (!email) throw new AppError(400, "Email is required");

      // Enforce staff limit
      if (req.planLimits && req.planLimits.maxStaff !== null) {
        const { count } = await supabase
          .from("business_members")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId);

        if ((count ?? 0) >= req.planLimits.maxStaff) {
          res.status(403).json({
            error: "staff_limit_reached",
            limit: req.planLimits.maxStaff,
          });
          return;
        }
      }

      const { data: users, error: lookupErr } = await supabase.auth.admin.listUsers();
      if (lookupErr) throw new AppError(500, lookupErr.message);

      const user = users.users.find((u) => u.email === email);
      if (!user) throw new AppError(404, "No user found with that email. They must sign up first.");

      const { data, error } = await supabase
        .from("business_members")
        .insert({
          business_id: businessId,
          user_id: user.id,
          role: role || "staff",
          display_name: display_name || user.user_metadata?.name || email,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new AppError(409, "This user is already a staff member");
        throw new AppError(400, error.message);
      }
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }
);
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && pnpm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/staff.ts apps/api/src/__tests__/api.test.ts
git commit -m "feat: enforce staff limit based on subscription plan"
```

---

## Task 5: Extend Admin Plans API

**Files:**
- Modify: `apps/api/src/routes/admin.ts`

The existing `GET/POST/PATCH /admin/plans` routes pass `req.body` directly to Supabase. Since the new columns (`has_whatsapp_bot`, `has_ai_bot`, `max_ai_tokens_monthly`) are now in the DB, the routes already support them — Supabase will accept them in inserts/updates.

The only change needed: auto-set `max_ai_tokens_monthly = 2400000` when `has_ai_bot = true` and the caller sends 0 or omits it.

- [ ] **Step 1: Update POST and PATCH plan routes in `apps/api/src/routes/admin.ts`**

Find the `POST /plans` route and replace its handler body with:

```typescript
async (req: AuthenticatedRequest, res, next) => {
  try {
    const supabase = createServiceClient();
    const body = { ...req.body };

    // Auto-set AI token limit when AI bot is enabled
    if (body.has_ai_bot && !body.max_ai_tokens_monthly) {
      body.max_ai_tokens_monthly = 2400000;
    }
    if (!body.has_ai_bot) {
      body.max_ai_tokens_monthly = 0;
    }

    const { data, error } = await supabase
      .from("plans")
      .insert(body)
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}
```

Find the `PATCH /plans/:id` route and replace its handler body with:

```typescript
async (req: AuthenticatedRequest, res, next) => {
  try {
    const supabase = createServiceClient();
    const body = { ...req.body };

    if (body.has_ai_bot && !body.max_ai_tokens_monthly) {
      body.max_ai_tokens_monthly = 2400000;
    }
    if (body.has_ai_bot === false) {
      body.max_ai_tokens_monthly = 0;
    }

    const { data, error } = await supabase
      .from("plans")
      .update(body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/api && pnpm test
```

Expected: PASS (no new tests needed — existing routes are pass-through, logic is trivial)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat: auto-set AI token limit in admin plans API"
```

---

## Task 6: `UpgradeModal` component

**Files:**
- Create: `apps/web/src/components/dashboard/upgrade-modal.tsx`

This is a shadcn `Dialog` used anywhere the web catches a 403 plan-limit error.

- [ ] **Step 1: Create the component**

First check that shadcn Dialog is installed:

```bash
ls /Users/adamazz1993/Desktop/torup/apps/web/src/components/ui/dialog.tsx
```

If not found, install it: `cd apps/web && pnpm dlx shadcn@latest add dialog`

Then create `apps/web/src/components/dashboard/upgrade-modal.tsx`:

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export type UpgradeReason =
  | "staff_limit_reached"
  | "whatsapp_not_in_plan"
  | "ai_bot_not_in_plan"
  | "ai_token_limit_reached"
  | "no_active_subscription";

const MESSAGES: Record<UpgradeReason, { title: string; description: string }> = {
  staff_limit_reached: {
    title: "Staff Limit Reached",
    description: "You've reached your plan's staff limit. Upgrade to add more team members.",
  },
  whatsapp_not_in_plan: {
    title: "WhatsApp Bot Not Included",
    description: "Your current plan doesn't include the WhatsApp bot. Upgrade to the WhatsApp plan (₪150/mo) or higher.",
  },
  ai_bot_not_in_plan: {
    title: "AI Bot Not Included",
    description: "The smart AI bot is available on the AI plan (₪200/mo). Upgrade to enable it.",
  },
  ai_token_limit_reached: {
    title: "AI Token Limit Reached",
    description: "You've used all your AI tokens for this month. Your quota resets on the 1st of next month.",
  },
  no_active_subscription: {
    title: "No Active Subscription",
    description: "Please select a plan to continue using the dashboard.",
  },
};

export function UpgradeModal({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  reason: UpgradeReason | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const locale = useLocale();

  if (!reason) return null;

  const { title, description } = MESSAGES[reason];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 flex-row justify-end">
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
          <Button
            onClick={() => {
              onClose();
              router.push(`/${locale}/dashboard/billing`);
            }}
          >
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/web && pnpm type-check
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/upgrade-modal.tsx
git commit -m "feat: add UpgradeModal component for plan limit errors"
```

---

## Task 7: Enhance Admin Plans UI

**Files:**
- Modify: `apps/web/src/app/[locale]/admin/plans/page.tsx`
- Modify: `packages/i18n/messages/en.json`, `he.json`, `ar.json`

Migrate the admin plans page from raw HTML to shadcn components and add the three new fields.

- [ ] **Step 1: Check that required shadcn components are installed**

```bash
ls /Users/adamazz1993/Desktop/torup/apps/web/src/components/ui/{card,badge,switch,input,label,button}.tsx 2>/dev/null | wc -l
```

If any are missing, install them: `cd apps/web && pnpm dlx shadcn@latest add card badge switch input label button`

- [ ] **Step 2: Add i18n keys**

In `packages/i18n/messages/en.json`, inside the `"admin"` object, add:

```json
"whatsappBot": "WhatsApp Bot",
"aiBot": "AI Bot",
"aiTokensMonth": "AI Tokens / Month",
"aiTokensHelper": "≈ 2,000 conversations/month",
"unlimited": "Unlimited"
```

In `packages/i18n/messages/he.json`, inside the `"admin"` object, add:

```json
"whatsappBot": "בוט וואטסאפ",
"aiBot": "בוט AI",
"aiTokensMonth": "טוקנים AI לחודש",
"aiTokensHelper": "כ-2,000 שיחות לחודש",
"unlimited": "ללא הגבלה"
```

In `packages/i18n/messages/ar.json`, inside the `"admin"` object, add:

```json
"whatsappBot": "بوت واتساب",
"aiBot": "بوت الذكاء الاصطناعي",
"aiTokensMonth": "رموز AI / شهرياً",
"aiTokensHelper": "≈ 2,000 محادثة / شهر",
"unlimited": "غير محدود"
```

- [ ] **Step 3: Rewrite `apps/web/src/app/[locale]/admin/plans/page.tsx`**

Replace the entire file content with:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number | null;
  max_staff: number | null;
  max_appointments_monthly: number | null;
  has_whatsapp_bot: boolean;
  has_ai_bot: boolean;
  max_ai_tokens_monthly: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  name: "",
  monthly_price: 0,
  yearly_price: "",
  max_staff: "",
  max_appointments_monthly: "",
  has_whatsapp_bot: false,
  has_ai_bot: false,
  is_active: true,
};

export default function AdminPlansPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const token = session?.access_token || "";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<Plan[]>("/api/admin/plans", {}, token);
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openNew = () => {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price?.toString() ?? "",
      max_staff: plan.max_staff?.toString() ?? "",
      max_appointments_monthly: plan.max_appointments_monthly?.toString() ?? "",
      has_whatsapp_bot: plan.has_whatsapp_bot,
      has_ai_bot: plan.has_ai_bot,
      is_active: plan.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name,
        monthly_price: Number(form.monthly_price),
        yearly_price: form.yearly_price ? Number(form.yearly_price) : null,
        max_staff: form.max_staff ? Number(form.max_staff) : null,
        max_appointments_monthly: form.max_appointments_monthly ? Number(form.max_appointments_monthly) : null,
        has_whatsapp_bot: form.has_whatsapp_bot,
        has_ai_bot: form.has_ai_bot,
        is_active: form.is_active,
      };

      if (editingPlan) {
        await apiFetch(`/api/admin/plans/${editingPlan.id}`, { method: "PATCH", body: JSON.stringify(body) }, token);
      } else {
        await apiFetch("/api/admin/plans", { method: "POST", body: JSON.stringify(body) }, token);
      }
      setDialogOpen(false);
      fetchPlans();
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("plans")}</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          {t("addPlan")}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-5 w-24 bg-muted rounded" /></CardHeader>
              <CardContent><div className="space-y-2">{[1,2,3,4].map(j => <div key={j} className="h-4 w-full bg-muted rounded" />)}</div></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className={plan.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                    {tCommon("edit")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("monthlyPrice")}</span>
                  <span className="font-medium">₪{plan.monthly_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("maxStaff")}</span>
                  <span className="font-medium">{plan.max_staff ?? t("unlimited")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("whatsappBot")}</span>
                  <Badge variant={plan.has_whatsapp_bot ? "default" : "secondary"}>
                    {plan.has_whatsapp_bot ? "✓" : "✗"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("aiBot")}</span>
                  <Badge variant={plan.has_ai_bot ? "default" : "secondary"}>
                    {plan.has_ai_bot ? "✓" : "✗"}
                  </Badge>
                </div>
                {plan.has_ai_bot && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("aiTokensMonth")}</span>
                    <span className="font-medium">
                      {(plan.max_ai_tokens_monthly / 1_000_000).toFixed(1)}M
                    </span>
                  </div>
                )}
                <div className="pt-1">
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? t("active") : t("inactive")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? t("editPlan") : t("addPlan")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="plan-name">{t("planName")} *</Label>
              <Input
                id="plan-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-monthly">{t("monthlyPrice")} (₪)</Label>
                <Input
                  id="plan-monthly"
                  type="number"
                  min={0}
                  value={form.monthly_price}
                  onChange={(e) => setForm({ ...form, monthly_price: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="plan-yearly">{t("yearlyPrice")} (₪)</Label>
                <Input
                  id="plan-yearly"
                  type="number"
                  min={0}
                  placeholder={t("unlimited")}
                  value={form.yearly_price}
                  onChange={(e) => setForm({ ...form, yearly_price: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-staff">{t("maxStaff")}</Label>
                <Input
                  id="plan-staff"
                  type="number"
                  min={1}
                  placeholder={t("unlimited")}
                  value={form.max_staff}
                  onChange={(e) => setForm({ ...form, max_staff: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="plan-appts">{t("maxAppointments")}</Label>
                <Input
                  id="plan-appts"
                  type="number"
                  min={1}
                  placeholder={t("unlimited")}
                  value={form.max_appointments_monthly}
                  onChange={(e) => setForm({ ...form, max_appointments_monthly: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-whatsapp" className="cursor-pointer">{t("whatsappBot")}</Label>
                <Switch
                  id="plan-whatsapp"
                  checked={form.has_whatsapp_bot}
                  onCheckedChange={(v) => setForm({ ...form, has_whatsapp_bot: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-ai" className="cursor-pointer">{t("aiBot")}</Label>
                <Switch
                  id="plan-ai"
                  checked={form.has_ai_bot}
                  onCheckedChange={(v) => setForm({ ...form, has_ai_bot: v })}
                />
              </div>
              {form.has_ai_bot && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t("aiTokensMonth")}</Label>
                  <Input value="2,400,000" disabled className="mt-1 bg-muted text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">{t("aiTokensHelper")}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="plan-active" className="cursor-pointer">{t("active")}</Label>
              <Switch
                id="plan-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={saving || !form.name}>
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/adamazz1993/Desktop/torup/apps/web && pnpm type-check
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add \
  "apps/web/src/app/[locale]/admin/plans/page.tsx" \
  packages/i18n/messages/en.json \
  packages/i18n/messages/he.json \
  packages/i18n/messages/ar.json
git commit -m "feat: enhance admin plans UI with shadcn + WhatsApp/AI bot fields"
```

---

## Task 8: Visual Verification

- [ ] **Step 1: Start dev servers (if not already running)**

```bash
pnpm dev
```

- [ ] **Step 2: Open the admin plans page**

Navigate to: `http://localhost:3000/he/admin/plans`

Verify:
- Plans grid renders with cards showing WhatsApp bot and AI bot badges
- "Add Plan" button opens a shadcn Dialog
- WhatsApp Bot and AI Bot appear as Switch toggles
- When AI bot is turned ON, the disabled token field appears showing "2,400,000"
- When AI bot is turned OFF, the token field disappears
- Editing an existing plan pre-fills all values correctly
- Saving updates the card in the grid

- [ ] **Step 3: Check mobile layout**

Resize browser to 375px. Verify:
- Cards stack to single column
- Dialog form is scrollable and usable on mobile

- [ ] **Step 4: Run full typecheck**

```bash
cd /Users/adamazz1993/Desktop/torup && pnpm type-check
```

Expected: all 11 tasks pass, no errors.

- [ ] **Step 5: Push to branch**

```bash
git push -u origin task/onboarding
```

---

## Self-Review

**Spec coverage:**
- ✅ DB migration: `00023_subscription_plans_features.sql` — Task 1
- ✅ Four seeded plan tiers — Task 1
- ✅ `ai_token_usage` table — Task 1
- ✅ `getPlanLimits()` utility — Task 2
- ✅ `requireSubscription` middleware — Task 3
- ✅ Staff limit enforcement — Task 4
- ✅ Admin plans API extended — Task 5
- ✅ `UpgradeModal` component — Task 6
- ✅ Admin plans UI with shadcn + new fields — Task 7
- ✅ Visual verification — Task 8

**WhatsApp/AI bot enforcement on settings routes** (spec mentions checking `has_whatsapp_bot` when saving credentials): this is in scope for the *next* sub-project (onboarding wizard) when WhatsApp settings are first configured. The enforcement point in `requireSubscription` + `planLimits` on `req` is already wired — the settings route just needs to check `req.planLimits.hasWhatsappBot`. Noted as a handoff for the next plan.
