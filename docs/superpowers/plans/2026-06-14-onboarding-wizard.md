# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a new user registers, redirect them through a 3-step wizard (Business Setup → Choose Plan → Pay via PayPlus) before they can access the dashboard.

**Architecture:** A single Next.js wizard page at `/[locale]/onboarding` manages 3 steps in React state. The API layer reuses the existing PayPlus service (`services/payplus.ts`) and billing route (`routes/billing.ts`), extended with annual billing and configurable redirect URLs. Dashboard layout gains a subscription gate that redirects to `/onboarding` if no active subscription exists.

**Tech Stack:** Next.js 15 App Router, shadcn/ui, next-intl, Express, PayPlus sandbox (`restapidev.payplus.co.il`), Supabase

---

## File Map

| File | Action |
|------|--------|
| `apps/api/src/routes/plans.ts` | **Create** — public GET /plans endpoint |
| `apps/api/src/routes/onboarding.ts` | **Create** — POST /onboarding/business |
| `apps/api/src/services/payplus.ts` | **Modify** — accept `successUrl`/`failureUrl` params |
| `apps/api/src/services/subscription.ts` | **Modify** — upsert in `activateSubscription`, support annual period |
| `apps/api/src/routes/billing.ts` | **Modify** — `POST /subscribe` accepts `billing` + `success_url`/`failure_url`; webhook reads `billing` from `more_info` |
| `apps/api/src/index.ts` | **Modify** — register `/plans` and `/onboarding` routes |
| `apps/web/src/app/[locale]/onboarding/page.tsx` | **Create** — 3-step wizard |
| `apps/web/src/app/[locale]/onboarding/layout.tsx` | **Create** — bare layout (no sidebar) |
| `apps/web/src/app/[locale]/onboarding/callback/page.tsx` | **Create** — PayPlus redirect handler |
| `apps/web/src/app/[locale]/(auth)/register/page.tsx` | **Modify** — redirect to `/onboarding` after signUp |
| `apps/web/src/app/[locale]/dashboard/layout.tsx` | **Modify** — add subscription gate |
| `packages/i18n/messages/en.json` | **Modify** — add `onboarding` section |
| `packages/i18n/messages/he.json` | **Modify** — add `onboarding` section |
| `packages/i18n/messages/ar.json` | **Modify** — add `onboarding` section |

---

### Task 1: Public Plans API Endpoint

**Files:**
- Create: `apps/api/src/routes/plans.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create `apps/api/src/routes/plans.ts`**

```typescript
import { Router, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { AppError } from "../middleware/error-handler.js";

const router: Router = Router();

// GET /plans — public, returns active plans ordered by price
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, monthly_price, yearly_price, max_staff, max_appointments_monthly, has_whatsapp_bot, has_ai_bot, max_ai_tokens_monthly, is_active")
      .eq("is_active", true)
      .order("monthly_price", { ascending: true });

    if (error) throw new AppError(500, error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Register routes in `apps/api/src/index.ts`**

Add these two imports near the top (after the existing imports):
```typescript
import plansRouter from "./routes/plans.js";
import onboardingRouter from "./routes/onboarding.js";
```

Add these two registrations after `app.use("/api/admin", adminRouter);`:
```typescript
// Public plans
app.use("/api/plans", plansRouter);

// Self-service onboarding
app.use("/api/onboarding", onboardingRouter);
```

- [ ] **Step 3: Test**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm --filter @torup/api test
```

Expected: existing tests pass (new route has no tests yet — covered by integration in later tasks).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/plans.ts apps/api/src/index.ts
git commit -m "feat: add public GET /plans endpoint"
```

---

### Task 2: Onboarding Business Creation API

**Files:**
- Create: `apps/api/src/routes/onboarding.ts`

- [ ] **Step 1: Create `apps/api/src/routes/onboarding.ts`**

```typescript
import { Router, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: Router = Router();

// POST /onboarding/business — self-service business creation
// Creates a business + business_member (owner) for the authenticated user.
// Returns 409 if the user already owns a business.
router.post(
  "/business",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const userId = req.userId!;
      const { name, category, phone, address } = req.body;

      if (!name?.trim()) throw new AppError(400, "name is required");
      if (!category?.trim()) throw new AppError(400, "category is required");
      if (!phone?.trim()) throw new AppError(400, "phone is required");

      // Prevent duplicate: one business per user
      const { data: existing } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) throw new AppError(409, "User already has a business");

      // Generate slug from business name
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 60) + "-" + Math.random().toString(36).slice(2, 6);

      // Create business
      const { data: business, error: bizErr } = await supabase
        .from("businesses")
        .insert({
          name: name.trim(),
          slug,
          category,
          phone: phone.trim(),
          address: address?.trim() || null,
          email: req.userEmail || null,
          is_active: true,
        })
        .select()
        .single();

      if (bizErr) throw new AppError(400, bizErr.message);

      // Add user as business_owner
      const { error: memberErr } = await supabase
        .from("business_members")
        .insert({
          business_id: business.id,
          user_id: userId,
          role: "business_owner",
          display_name: req.userEmail || "Owner",
        });

      if (memberErr) throw new AppError(400, memberErr.message);

      res.status(201).json({ business_id: business.id });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

- [ ] **Step 2: Write test**

In `apps/api/src/routes/__tests__/onboarding.test.ts` (create if the `__tests__` folder exists, otherwise skip — check with `ls apps/api/src/routes/__tests__/` first):

```typescript
// If __tests__ folder doesn't exist, skip this step and note it
// The route is covered by manual testing in the integration flow
```

- [ ] **Step 3: Test**

```bash
pnpm --filter @torup/api test
```

Expected: existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/onboarding.ts
git commit -m "feat: add POST /onboarding/business self-service route"
```

---

### Task 3: Billing API — Annual Support + Custom Redirects + Upsert Activation

**Files:**
- Modify: `apps/api/src/services/payplus.ts`
- Modify: `apps/api/src/services/subscription.ts`
- Modify: `apps/api/src/routes/billing.ts`

- [ ] **Step 1: Update `generatePaymentPage` in `apps/api/src/services/payplus.ts`**

Add `successUrl?: string` and `failureUrl?: string` to the params interface and use them:

Find the `generatePaymentPage` function signature and replace it with:

```typescript
export async function generatePaymentPage(params: {
  amount: number;
  currency?: string;
  description: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  business_id: string;
  plan_id: string;
  billing?: "monthly" | "annual";
  recurring?: boolean;
  successUrl?: string;
  failureUrl?: string;
}): Promise<{ paymentPageUrl: string; pageRequestUid: string }> {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const apiUrl = process.env.API_URL || "http://localhost:3001";

  const response = await payPlusRequest<PaymentPageResponse>(
    "/PaymentPages/generateLink",
    "POST",
    {
      payment_page_uid: process.env.PAYPLUS_PAGE_UID || "",
      amount: params.amount,
      currency_code: params.currency || "ILS",
      charge_method: params.recurring ? 2 : 1,
      description: params.description,
      customer: {
        customer_name: params.customer_name,
        email: params.customer_email,
        phone: params.customer_phone || "",
      },
      more_info: JSON.stringify({
        business_id: params.business_id,
        plan_id: params.plan_id,
        billing: params.billing || "monthly",
      }),
      sendEmailApproval: true,
      refURL_success: params.successUrl || `${appUrl}/dashboard/billing?status=success`,
      refURL_failure: params.failureUrl || `${appUrl}/dashboard/billing?status=failed`,
      refURL_callback: `${apiUrl}/api/billing/webhook`,
    }
  );

  return {
    paymentPageUrl: response.data.payment_page_link,
    pageRequestUid: response.data.page_request_uid,
  };
}
```

- [ ] **Step 2: Update `activateSubscription` in `apps/api/src/services/subscription.ts`**

Replace the existing `activateSubscription` function:

```typescript
export async function activateSubscription(
  businessId: string,
  planId: string,
  payplusSubscriptionId?: string,
  billing: "monthly" | "annual" = "monthly"
): Promise<void> {
  const supabase = createServiceClient();

  const now = new Date();
  const daysInPeriod = billing === "annual" ? 365 : 30;
  const periodEnd = new Date(now.getTime() + daysInPeriod * 24 * 60 * 60 * 1000);

  await supabase
    .from("subscriptions")
    .upsert(
      {
        business_id: businessId,
        plan_id: planId,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        payplus_subscription_id: payplusSubscriptionId || null,
      },
      { onConflict: "business_id" }
    );
}
```

- [ ] **Step 3: Update `POST /billing/subscribe` in `apps/api/src/routes/billing.ts`**

Replace the existing `POST /subscribe` handler body:

```typescript
router.post(
  "/subscribe",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { business_id, plan_id, billing = "monthly", success_url, failure_url } = req.body;

      const supabase = createServiceClient();

      const { data: plan } = await supabase
        .from("plans")
        .select("name, monthly_price, yearly_price")
        .eq("id", plan_id)
        .single();

      if (!plan) throw new AppError(404, "Plan not found");

      const { data: business } = await supabase
        .from("businesses")
        .select("name, email")
        .eq("id", business_id)
        .single();

      if (!business) throw new AppError(404, "Business not found");

      // Compute amount based on billing period
      let amount: number;
      if (billing === "annual") {
        amount = plan.yearly_price != null
          ? plan.yearly_price * 12
          : Math.round(plan.monthly_price * 0.9 * 12);
      } else {
        amount = plan.monthly_price;
      }

      const result = await generatePaymentPage({
        amount,
        description: `${plan.name} - ${business.name} (${billing})`,
        customer_name: business.name,
        customer_email: business.email || req.userEmail || "",
        business_id,
        plan_id,
        billing,
        recurring: true,
        successUrl: success_url,
        failureUrl: failure_url,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
```

- [ ] **Step 4: Update the webhook handler in `apps/api/src/routes/billing.ts` to pass `billing` to `activateSubscription`**

Find the webhook handler line that calls `activateSubscription` and replace:

```typescript
// OLD:
await activateSubscription(
  context.business_id,
  context.plan_id || "",
  transaction?.uid
);

// NEW:
await activateSubscription(
  context.business_id,
  context.plan_id || "",
  transaction?.uid,
  (context as { billing?: string }).billing === "annual" ? "annual" : "monthly"
);
```

Also update the type for `context`:
```typescript
let context: { business_id?: string; plan_id?: string; billing?: string } = {};
```

- [ ] **Step 5: Test**

```bash
pnpm --filter @torup/api test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/payplus.ts apps/api/src/services/subscription.ts apps/api/src/routes/billing.ts
git commit -m "feat: billing API supports annual billing period and custom PayPlus redirect URLs"
```

---

### Task 4: i18n Keys

**Files:**
- Modify: `packages/i18n/messages/en.json`
- Modify: `packages/i18n/messages/he.json`
- Modify: `packages/i18n/messages/ar.json`

- [ ] **Step 1: Add `onboarding` section to `packages/i18n/messages/en.json`**

Before the closing `}` of the JSON, add:

```json
,
"onboarding": {
  "title": "Set Up Your Business",
  "step1": "Business Details",
  "step2": "Choose a Plan",
  "step3": "Payment",
  "businessName": "Business Name",
  "category": "Category",
  "selectCategory": "Select a category",
  "phone": "Phone",
  "address": "Address (optional)",
  "next": "Next",
  "back": "Back",
  "monthly": "Monthly",
  "annual": "Annual",
  "savePercent": "Save 10%",
  "mostPopular": "Most Popular",
  "perMonth": "/mo",
  "billedAnnually": "billed annually",
  "choosePlan": "Choose {name}",
  "payNow": "Pay Now",
  "orderSummary": "Order Summary",
  "plan": "Plan",
  "billing": "Billing",
  "amount": "Amount",
  "redirectingToPayment": "Redirecting to payment...",
  "paymentFailed": "Payment failed. Please try again.",
  "tryAgain": "Try Again",
  "paymentSuccess": "Payment successful! Setting up your account...",
  "unlimitedStaff": "Unlimited staff",
  "staffUpTo": "Up to {count} staff"
}
```

- [ ] **Step 2: Add `onboarding` section to `packages/i18n/messages/he.json`**

```json
,
"onboarding": {
  "title": "הגדר את העסק שלך",
  "step1": "פרטי העסק",
  "step2": "בחר תוכנית",
  "step3": "תשלום",
  "businessName": "שם העסק",
  "category": "קטגוריה",
  "selectCategory": "בחר קטגוריה",
  "phone": "טלפון",
  "address": "כתובת (אופציונלי)",
  "next": "הבא",
  "back": "חזור",
  "monthly": "חודשי",
  "annual": "שנתי",
  "savePercent": "חסוך 10%",
  "mostPopular": "הפופולרי ביותר",
  "perMonth": "/חו׳",
  "billedAnnually": "לחיוב שנתי",
  "choosePlan": "בחר {name}",
  "payNow": "שלם עכשיו",
  "orderSummary": "סיכום הזמנה",
  "plan": "תוכנית",
  "billing": "חיוב",
  "amount": "סכום",
  "redirectingToPayment": "מעביר לתשלום...",
  "paymentFailed": "התשלום נכשל. אנא נסה שוב.",
  "tryAgain": "נסה שוב",
  "paymentSuccess": "התשלום הצליח! מגדיר את החשבון שלך...",
  "unlimitedStaff": "צוות ללא הגבלה",
  "staffUpTo": "עד {count} אנשי צוות"
}
```

- [ ] **Step 3: Add `onboarding` section to `packages/i18n/messages/ar.json`**

```json
,
"onboarding": {
  "title": "إعداد عملك",
  "step1": "تفاصيل العمل",
  "step2": "اختر خطة",
  "step3": "الدفع",
  "businessName": "اسم العمل",
  "category": "الفئة",
  "selectCategory": "اختر فئة",
  "phone": "الهاتف",
  "address": "العنوان (اختياري)",
  "next": "التالي",
  "back": "رجوع",
  "monthly": "شهري",
  "annual": "سنوي",
  "savePercent": "وفر 10%",
  "mostPopular": "الأكثر شعبية",
  "perMonth": "/شهر",
  "billedAnnually": "يُفوتر سنوياً",
  "choosePlan": "اختر {name}",
  "payNow": "ادفع الآن",
  "orderSummary": "ملخص الطلب",
  "plan": "الخطة",
  "billing": "الفواتير",
  "amount": "المبلغ",
  "redirectingToPayment": "جارٍ التحويل إلى الدفع...",
  "paymentFailed": "فشل الدفع. يرجى المحاولة مرة أخرى.",
  "tryAgain": "حاول مرة أخرى",
  "paymentSuccess": "تم الدفع بنجاح! جارٍ إعداد حسابك...",
  "unlimitedStaff": "موظفون غير محدودين",
  "staffUpTo": "حتى {count} موظف"
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/
git commit -m "feat: add onboarding i18n keys (en/he/ar)"
```

---

### Task 5: Onboarding Wizard Page

**Files:**
- Create: `apps/web/src/app/[locale]/onboarding/layout.tsx`
- Create: `apps/web/src/app/[locale]/onboarding/page.tsx`

The wizard manages step state locally. Step 1 calls the API to create the business. Step 2 fetches plans and lets the user pick one. Step 3 calls `POST /api/billing/subscribe` and redirects to PayPlus.

The existing `BUSINESS_CATEGORIES` list is duplicated here from the admin page. A future refactor could extract it to `packages/shared`, but YAGNI for now.

- [ ] **Step 1: Create `apps/web/src/app/[locale]/onboarding/layout.tsx`**

```typescript
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-base, hsl(242 44% 8%))" }}>
        {children}
      </div>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/app/[locale]/onboarding/page.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const BUSINESS_CATEGORIES = [
  { value: "barber", label_he: "מספרה", label_en: "Barber", label_ar: "حلاق" },
  { value: "hair_salon", label_he: "סלון שיער", label_en: "Hair Salon", label_ar: "صالون شعر" },
  { value: "beauty_salon", label_he: "סלון יופי", label_en: "Beauty Salon", label_ar: "صالون تجميل" },
  { value: "nail_salon", label_he: "סלון ציפורניים", label_en: "Nail Salon", label_ar: "صالون أظافر" },
  { value: "spa", label_he: "ספא", label_en: "Spa", label_ar: "سبا" },
  { value: "gym", label_he: "חדר כושר", label_en: "Gym", label_ar: "صالة رياضية" },
  { value: "clinic", label_he: "קליניקה", label_en: "Clinic", label_ar: "عيادة" },
  { value: "dental", label_he: "מרפאת שיניים", label_en: "Dental", label_ar: "عيادة أسنان" },
  { value: "physiotherapy", label_he: "פיזיותרפיה", label_en: "Physiotherapy", label_ar: "علاج طبيعي" },
  { value: "tattoo", label_he: "קעקועים", label_en: "Tattoo", label_ar: "وشم" },
  { value: "yoga_studio", label_he: "סטודיו יוגה", label_en: "Yoga Studio", label_ar: "استوديو يوغا" },
  { value: "pet_grooming", label_he: "טיפוח חיות מחמד", label_en: "Pet Grooming", label_ar: "تجميل حيوانات" },
  { value: "auto_service", label_he: "מוסך / שירות רכב", label_en: "Auto Service", label_ar: "خدمة سيارات" },
  { value: "consulting", label_he: "ייעוץ", label_en: "Consulting", label_ar: "استشارات" },
  { value: "tutoring", label_he: "שיעורים פרטיים", label_en: "Tutoring", label_ar: "دروس خصوصية" },
  { value: "photography", label_he: "צילום", label_en: "Photography", label_ar: "تصوير" },
  { value: "other", label_he: "אחר", label_en: "Other", label_ar: "أخرى" },
];

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number | null;
  max_staff: number | null;
  has_whatsapp_bot: boolean;
  has_ai_bot: boolean;
  max_ai_tokens_monthly: number;
}

const inputClass = "w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const router = useRouter();
  const { session } = useAuth();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Step 2 state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    if (step === 2 && plans.length === 0) {
      fetch(`${API_URL}/api/plans`)
        .then((r) => r.json())
        .then(setPlans)
        .catch(() => setError("Failed to load plans"));
    }
  }, [step, plans.length]);

  const getCategoryLabel = (cat: typeof BUSINESS_CATEGORIES[0]) => {
    if (locale === "he") return cat.label_he;
    if (locale === "ar") return cat.label_ar;
    return cat.label_en;
  };

  const getPlanPrice = (plan: Plan) => {
    if (billing === "annual") {
      return plan.yearly_price != null
        ? plan.yearly_price
        : Math.round(plan.monthly_price * 0.9);
    }
    return plan.monthly_price;
  };

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/onboarding/business`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: businessName, category, phone, address }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create business");
      }
      const data = await res.json();
      setBusinessId(data.business_id);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    if (!session || !businessId || !selectedPlan) return;
    setError("");
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await fetch(`${API_URL}/api/billing/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          plan_id: selectedPlan.id,
          billing,
          success_url: `${origin}/${locale}/onboarding/callback?status=success`,
          failure_url: `${origin}/${locale}/onboarding/callback?status=failed`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to initiate payment");
      }
      const { paymentPageUrl } = await res.json();
      window.location.href = paymentPageUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  };

  const stepLabels = [t("step1"), t("step2"), t("step3")];

  return (
    <div className={cn("w-full max-w-2xl", isRtl && "rtl")} dir={isRtl ? "rtl" : "ltr"}>
      {/* Progress bar */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">{t("title")}</h1>
        <div className="flex gap-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1">
              <div className={cn("h-1 rounded-full mb-1.5 transition-colors", i + 1 <= step ? "bg-indigo-500" : "bg-white/10")} />
              <span className={cn("text-xs", i + 1 === step ? "text-white font-medium" : "text-white/40")}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Step 1 — Business Details */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-4 bg-white/4 border border-white/10 rounded-xl p-6">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">{t("businessName")}</Label>
            <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} placeholder="My Business" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">{t("category")}</Label>
            <select required value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              <option value="">{t("selectCategory")}</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{getCategoryLabel(c)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">{t("phone")}</Label>
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="050-0000000" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs font-semibold uppercase tracking-wide">{t("address")}</Label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="Tel Aviv" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "..." : t("next")}
          </Button>
        </form>
      )}

      {/* Step 2 — Choose Plan */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Monthly / Annual toggle */}
          <div className="flex justify-center">
            <div className="inline-flex bg-white/5 border border-white/10 rounded-full p-1 gap-1">
              <button
                onClick={() => setBilling("monthly")}
                className={cn("px-5 py-1.5 rounded-full text-sm font-medium transition-colors", billing === "monthly" ? "bg-indigo-600 text-white" : "text-white/50 hover:text-white")}
              >
                {t("monthly")}
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={cn("px-5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5", billing === "annual" ? "bg-indigo-600 text-white" : "text-white/50 hover:text-white")}
              >
                {t("annual")} <span className="text-xs text-violet-300">{t("savePercent")}</span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plans.map((plan) => {
              const price = getPlanPrice(plan);
              const isSelected = selectedPlan?.id === plan.id;
              const isPopular = plan.name === "AI";
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-all",
                    isSelected
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-white/10 bg-white/4 hover:border-white/20"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">{plan.name}</span>
                    {isPopular && <Badge className="text-xs">{t("mostPopular")}</Badge>}
                  </div>
                  <div className="text-2xl font-bold text-white mb-3">
                    {price}<span className="text-sm font-normal text-white/40">₪{t("perMonth")}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className={plan.max_staff !== null ? "text-white/70" : "text-white/70"}>
                      {plan.max_staff === null ? t("unlimitedStaff") : t("staffUpTo", { count: plan.max_staff })}
                    </div>
                    <div className={plan.has_whatsapp_bot ? "text-white/70" : "text-white/30"}>
                      {plan.has_whatsapp_bot ? "✓" : "✗"} WhatsApp bot
                    </div>
                    <div className={plan.has_ai_bot ? "text-white/70" : "text-white/30"}>
                      {plan.has_ai_bot ? "✓" : "✗"} AI bot
                    </div>
                    {plan.has_ai_bot && (
                      <div className="text-white/40 text-xs">≈ 2,000 chats/mo</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">{t("back")}</Button>
            <Button onClick={() => setStep(3)} disabled={!selectedPlan} className="flex-1">{t("next")}</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Payment */}
      {step === 3 && selectedPlan && (
        <div className="bg-white/4 border border-white/10 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t("orderSummary")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-white/70">
              <span>{t("plan")}</span>
              <span className="text-white font-medium">{selectedPlan.name}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>{t("billing")}</span>
              <span className="text-white">{billing === "annual" ? t("annual") : t("monthly")}</span>
            </div>
            <div className="flex justify-between text-white/70 border-t border-white/10 pt-2 mt-2">
              <span>{t("amount")}</span>
              <span className="text-white font-bold text-base">
                {getPlanPrice(selectedPlan)}₪{t("perMonth")}
                {billing === "annual" && <span className="text-white/40 text-xs ms-1">({t("billedAnnually")})</span>}
              </span>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep(2)} className="flex-1">{t("back")}</Button>
            <Button onClick={handleStep3} disabled={loading} className="flex-1">
              {loading ? t("redirectingToPayment") : t("payNow")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Test — start dev server and open the page**

```bash
cd /Users/adamazz1993/Desktop/torup && pnpm dev
```

Open `http://localhost:3000/he/onboarding` — verify the 3 steps render, category dropdown shows Hebrew labels, monthly/annual toggle switches prices.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/onboarding/
git commit -m "feat: onboarding wizard — 3-step business setup + plan selection + payment initiation"
```

---

### Task 6: Payment Callback Page

**Files:**
- Create: `apps/web/src/app/[locale]/onboarding/callback/page.tsx`

- [ ] **Step 1: Create `apps/web/src/app/[locale]/onboarding/callback/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function OnboardingCallbackPage() {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (status === "success") {
      const interval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            router.replace(`/${locale}/dashboard`);
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, locale, router]);

  if (status === "success") {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">🎉</div>
        <p className="text-white font-medium">{t("paymentSuccess")}</p>
        <p className="text-white/40 text-sm">Redirecting in {countdown}s...</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="text-4xl">❌</div>
      <p className="text-red-300 font-medium">{t("paymentFailed")}</p>
      <Button onClick={() => router.replace(`/${locale}/onboarding`)}>
        {t("tryAgain")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/onboarding/callback/
git commit -m "feat: onboarding payment callback page"
```

---

### Task 7: Register Page — Redirect to Onboarding After Signup

**Files:**
- Modify: `apps/web/src/app/[locale]/(auth)/register/page.tsx`

- [ ] **Step 1: Change the redirect in `handleSubmit`**

Find the current `handleSubmit` in the register page:
```typescript
await signUp(email, password, name);
router.push(`/${locale}/dashboard`);
```

Replace with:
```typescript
await signUp(email, password, name);
router.push(`/${locale}/onboarding`);
```

- [ ] **Step 2: Test**

```bash
pnpm dev
```

Register a new test user at `http://localhost:3000/he/register` — verify it redirects to `/he/onboarding` instead of `/he/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(auth\)/register/page.tsx
git commit -m "feat: redirect new users to onboarding wizard after registration"
```

---

### Task 8: Dashboard Layout — Subscription Gate

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/layout.tsx`

The dashboard layout already wraps in `AuthGuard`. We add a subscription check: if the user has no active subscription, redirect to `/[locale]/onboarding`. The check calls `GET /api/billing/status?business_id=...` which already exists.

- [ ] **Step 1: Add `SubscriptionGuard` component inside `apps/web/src/app/[locale]/dashboard/layout.tsx`**

Read the current layout first. Then add this component above the `export default function DashboardLayout` line:

```typescript
function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!session) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Get user's business first
    fetch(`${API_URL}/api/businesses/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((business) => {
        if (!business) {
          // No business yet — send to onboarding
          router.replace(`/${locale}/onboarding`);
          return;
        }
        return fetch(`${API_URL}/api/billing/status?business_id=${business.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((r) => r.json())
          .then(({ subscription }) => {
            if (!subscription || subscription.status !== "active") {
              router.replace(`/${locale}/onboarding`);
            } else {
              setChecked(true);
            }
          });
      })
      .catch(() => setChecked(true)); // On error, let through (fail open)
  }, [session, router, locale]);

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
```

Also add `useState` to the imports at the top of the file if not already present:
```typescript
import { useState } from "react";
```

- [ ] **Step 2: Wrap children with `SubscriptionGuard` in the layout**

Find where `AuthGuard` wraps children in the layout's return statement. Wrap the inner content with `<SubscriptionGuard>`:

```typescript
// Inside the DashboardLayout return, wrap the page content (not the sidebar/topbar shell) with SubscriptionGuard
// The exact location depends on the current layout structure.
// Look for where {children} is rendered inside AuthGuard and add SubscriptionGuard around it.

// The AuthGuard already handles auth. SubscriptionGuard runs inside it.
// Wrap children in DashboardContent (or wherever {children} appears):
<SubscriptionGuard>
  {children}
</SubscriptionGuard>
```

Note: read the full layout to find the exact `{children}` location before making this change.

- [ ] **Step 3: Test**

```bash
pnpm dev
```

Log in as the test business user — verify they reach the dashboard (active subscription). Log in as a user with no business — verify redirect to `/onboarding`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/layout.tsx
git commit -m "feat: redirect users with no active subscription to onboarding wizard"
```

---

### Task 9: Add PayPlus Sandbox Env Vars

**Files:**
- Modify: `apps/api/.env`

- [ ] **Step 1: Add PayPlus sandbox variables to `apps/api/.env`**

The existing `.env` already has the app running. Add these lines (use sandbox values — get real credentials from PayPlus sandbox portal at https://restapidev.payplus.co.il):

```
PAYPLUS_API_URL=https://restapidev.payplus.co.il/api/v1.0
PAYPLUS_API_KEY=your_sandbox_api_key
PAYPLUS_SECRET_KEY=your_sandbox_secret_key
PAYPLUS_PAGE_UID=your_sandbox_payment_page_uid
PAYPLUS_TERMINAL_UID=your_sandbox_terminal_uid
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
```

- [ ] **Step 2: Verify the PayPlus service picks up the env vars**

```bash
node -e "
  require('dotenv/config');
  console.log('API URL:', process.env.PAYPLUS_API_URL);
  console.log('Page UID:', process.env.PAYPLUS_PAGE_UID);
" 2>/dev/null || echo "Run from apps/api dir"
```

- [ ] **Step 3: Commit (only if .env is NOT in .gitignore — it should be, so skip commit)**

```bash
# Verify .env is gitignored
grep -q "\.env" /Users/adamazz1993/Desktop/torup/.gitignore && echo "✓ .env is gitignored — do NOT commit it"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 3-step wizard: Tasks 5, 6
- ✅ `POST /api/onboarding/business`: Task 2
- ✅ `GET /api/plans` public: Task 1
- ✅ Monthly/annual toggle: Task 5 (wizard) + Task 3 (billing API)
- ✅ Annual = `yearly_price ?? monthly_price × 0.9`: Task 5 (`getPlanPrice`) + Task 3 (billing API amount calculation)
- ✅ PayPlus hosted page redirect: Task 3 (`generatePaymentPage` with `successUrl`/`failureUrl`)
- ✅ Callback page: Task 6
- ✅ Subscription activation via webhook: Task 3 (upsert + billing period in `activateSubscription`)
- ✅ Register redirect: Task 7
- ✅ Dashboard subscription gate: Task 8
- ✅ i18n all 3 locales: Task 4
- ✅ PayPlus sandbox: Task 9
- ✅ RTL support: Task 5 (`dir={isRtl ? "rtl" : "ltr"}` + locale-aware category labels)

**Placeholder scan:** No TBDs or TODOs in any task.

**Type consistency:**
- `billing: "monthly" | "annual"` — used consistently in Task 3 (API), Task 5 (wizard), Task 6 (callback)
- `businessId: string | null` — set in Step 1, passed to Step 3 ✅
- `selectedPlan: Plan | null` — set in Step 2, used in Step 3 ✅
- `generatePaymentPage` params extended — callers in `billing.ts` updated ✅
- `activateSubscription` signature extended with `billing` param — webhook caller updated ✅
