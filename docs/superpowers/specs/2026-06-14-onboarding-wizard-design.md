# Onboarding Wizard — Business Setup + Plan Selection + PayPlus Payment

## Goal

When a new user registers, redirect them through a 3-step wizard that collects their business details, selects a subscription plan, and completes payment via PayPlus recurring billing — before they can access the dashboard.

## Architecture

A single Next.js page at `/[locale]/onboarding` renders all 3 steps in client state with a progress bar. After registration, `signUp` redirects to `/onboarding` instead of `/dashboard`. Next.js middleware also intercepts authenticated users with no active subscription and sends them to `/onboarding`. Payment is handled via PayPlus hosted page redirect (PCI-compliant, no iframe). A callback page at `/[locale]/onboarding/callback` handles the PayPlus redirect and confirms the subscription server-side.

**Tech Stack:** Next.js 15 App Router, shadcn/ui, next-intl, PayPlus sandbox API, Express API

---

## Wizard Steps

### Step 1 — Business Setup

Fields:
- Business name — required, text input
- Category — required, select from existing `BUSINESS_CATEGORIES` list (17 options + Other), same list used in admin page
- Phone — required, text input
- Address — optional, text input

On "Next":
- Calls `POST /api/onboarding/business`
- Creates `businesses` row and `business_members` row (role = `business_owner`) for the authenticated user
- Stores returned `business_id` in React state
- Advances to Step 2

### Step 2 — Choose a Plan

- Fetches plans from `GET /api/plans` (new public endpoint, returns `is_active = true` plans ordered by `monthly_price`)
- Monthly / Annual billing toggle at the top
  - Monthly: show `monthly_price` (e.g. 200₪/mo)
  - Annual: show `yearly_price` if set, otherwise `monthly_price × 0.9` rounded to nearest integer (e.g. 180₪/mo, billed 2,160₪/year)
  - Show "Save 10%" badge next to Annual toggle
- 4 plan cards in a responsive grid (1 col mobile, 2 col md, 4 col lg)
- AI plan highlighted as "Most Popular"
- Each card shows: name, price, staff limit ("Unlimited" if null), WhatsApp bot ✓/✗, AI bot ✓/✗, AI token count if `has_ai_bot`
- Clicking a card selects it (highlighted border)
- "Continue" button enabled only when a plan is selected
- Selected plan + billing period stored in React state, passed to Step 3

### Step 3 — Payment

- Shows summary: selected plan name, price, billing period
- "Pay Now" button calls `POST /api/onboarding/payment/initiate`
- API creates a PayPlus recurring subscription payment page and returns a `payment_url`
- Frontend redirects to `payment_url` (PayPlus hosted page)
- On completion, PayPlus redirects to `/[locale]/onboarding/callback?status=success&token=...` or `?status=failed`

---

## Callback Page (`/[locale]/onboarding/callback`)

- Reads `status` and `token` from URL params
- On `status=success`: calls `POST /api/onboarding/payment/confirm` with the token
  - API verifies with PayPlus, creates `subscriptions` row (`status='active'`, `payplus_subscription_id` stored)
  - Redirects to `/[locale]/dashboard`
- On `status=failed`: shows error message with "Try Again" button that sends user back to Step 3 (redirect to `/[locale]/onboarding?step=3`)

---

## Middleware

File: `apps/web/src/middleware.ts` (extend existing)

Add a check: if user is authenticated and route is under `/dashboard`, verify they have an active subscription by checking a cookie or calling the API. If no active subscription → redirect to `/[locale]/onboarding`.

Implementation: after login/signup, set a short-lived cookie `has_subscription=true|false`. Middleware reads this cookie to avoid an API call on every request. Cookie is set/refreshed by the auth provider on session load.

---

## API Routes (Express)

### `POST /api/onboarding/business`
- Auth: `requireAuth`
- Body: `{ name, category, phone, address? }`
- Creates `businesses` row + `business_members` row (role=`business_owner`)
- Returns: `{ business_id }`
- Error: 409 if user already has a business

### `GET /api/plans` (new public endpoint)
- No auth required
- Returns all plans where `is_active = true`, ordered by `monthly_price ASC`
- Fields: `id, name, monthly_price, yearly_price, max_staff, has_whatsapp_bot, has_ai_bot, max_ai_tokens_monthly`

### `POST /api/onboarding/payment/initiate`
- Auth: `requireAuth`
- Body: `{ business_id, plan_id, billing: "monthly" | "annual" }`
- Validates: business belongs to authenticated user, plan exists and is active
- Computes amount: `billing=monthly` → `plan.monthly_price`, `billing=annual` → `plan.yearly_price ?? Math.round(plan.monthly_price * 0.9 * 12)`
- Calls PayPlus sandbox API to create recurring subscription payment page
- PayPlus success redirect URL: `{NEXT_PUBLIC_URL}/[locale]/onboarding/callback?status=success`
- PayPlus failure redirect URL: `{NEXT_PUBLIC_URL}/[locale]/onboarding/callback?status=failed`
- Returns: `{ payment_url }`

### `POST /api/onboarding/payment/confirm`
- Auth: `requireAuth`
- Body: `{ token, business_id, plan_id, billing: "monthly" | "annual" }`
- Verifies token with PayPlus sandbox API
- On success: upserts `subscriptions` row:
  ```
  business_id, plan_id, status='active',
  payplus_subscription_id = token,
  current_period_start = now(),
  current_period_end = now() + 1 month (or 1 year)
  ```
- Returns: `{ ok: true }`

### `POST /api/webhooks/payplus`
- No auth (PayPlus calls this)
- Verifies PayPlus signature header
- Logs all events to console (sandbox mode — full handler in future sub-project)
- Returns 200

---

## PayPlus Sandbox Integration

PayPlus sandbox base URL: `https://sandbox.payplus.co.il`

Required env vars:
```
PAYPLUS_API_KEY=...
PAYPLUS_SECRET_KEY=...
PAYPLUS_SANDBOX=true
```

PayPlus recurring subscription endpoint: `POST /api/v1.0/PaymentPages/generateLink`

Request body (recurring):
```json
{
  "payment_page_uid": "...",
  "charge_method": 1,
  "currency_code": "ILS",
  "amount": 200,
  "payments": 0,
  "end_date": "",
  "charge_period": "monthly",
  "successRedirectUrl": "...",
  "failureRedirectUrl": "...",
  "customer": { "customer_name": "...", "email": "..." }
}
```

`charge_period`: `"monthly"` or `"yearly"` based on billing selection.

---

## Frontend i18n Keys

Add to `packages/i18n/messages/{en,he,ar}.json` under `"onboarding"`:

| Key | English | Hebrew | Arabic |
|-----|---------|--------|--------|
| `title` | Set Up Your Business | הגדר את העסק שלך | إعداد عملك |
| `step1` | Business Details | פרטי העסק | تفاصيل العمل |
| `step2` | Choose a Plan | בחר תוכנית | اختر خطة |
| `step3` | Payment | תשלום | الدفع |
| `businessName` | Business Name | שם העסק | اسم العمل |
| `category` | Category | קטגוריה | الفئة |
| `selectCategory` | Select a category | בחר קטגוריה | اختر فئة |
| `next` | Next | הבא | التالي |
| `back` | Back | חזור | رجوع |
| `monthly` | Monthly | חודשי | شهري |
| `annual` | Annual | שנתי | سنوي |
| `savePercent` | Save 10% | חסוך 10% | وفر 10% |
| `mostPopular` | Most Popular | הפופולרי ביותר | الأكثر شعبية |
| `perMonth` | /mo | /חו׳ | /شهر |
| `billedAnnually` | billed annually | לחיוב שנתי | يُفوتر سنوياً |
| `choosePlan` | Choose {name} | בחר {name} | اختر {name} |
| `payNow` | Pay Now | שלם עכשיו | ادفع الآن |
| `orderSummary` | Order Summary | סיכום הזמנה | ملخص الطلب |
| `paymentFailed` | Payment failed. Please try again. | התשלום נכשל. נסה שוב. | فشل الدفع. حاول مرة أخرى. |
| `tryAgain` | Try Again | נסה שוב | حاول مرة أخرى |

---

## File Map

| File | Action |
|------|--------|
| `apps/web/src/app/[locale]/onboarding/page.tsx` | Create — 3-step wizard |
| `apps/web/src/app/[locale]/onboarding/callback/page.tsx` | Create — PayPlus redirect handler |
| `apps/web/src/app/[locale]/(auth)/register/page.tsx` | Modify — redirect to `/onboarding` after signUp |
| `apps/web/src/middleware.ts` | Modify — redirect no-subscription users to `/onboarding` |
| `apps/api/src/routes/onboarding.ts` | Create — all 3 onboarding API routes |
| `apps/api/src/routes/plans.ts` | Create — public GET /plans endpoint |
| `apps/api/src/lib/payplus.ts` | Create — PayPlus sandbox client |
| `apps/api/src/index.ts` | Modify — register `/onboarding` and `/plans` routes |
| `packages/i18n/messages/en.json` | Modify — add `onboarding` section |
| `packages/i18n/messages/he.json` | Modify — add `onboarding` section |
| `packages/i18n/messages/ar.json` | Modify — add `onboarding` section |

---

## Out of Scope

- PayPlus webhook renewal/failure handling (log only for now)
- Cancellation flow from dashboard
- Trial period
- Resuming a partially-completed wizard after page refresh (start over on refresh)
- WhatsApp bot setup during onboarding (done later in Settings)
