## Context

This is a greenfield multi-tenant SaaS platform for appointment/queue management targeting service businesses (barbers, gyms, clinics, studios) in the Israeli market. The platform must support Hebrew (RTL, default), Arabic (RTL), and English (LTR). Customers book via WhatsApp (primary channel) or a branded web booking page. Business owners manage everything through a dashboard. A super admin panel handles platform-wide operations.

**Tech stack decided by the founder:**
- Frontend: Next.js (React) with TypeScript
- Backend: Node.js + Express with TypeScript
- Database: PostgreSQL via Supabase (auth, realtime, RLS)
- Hosting: Google Cloud Platform
- Payments: PayPlus (Israeli payment provider)
- WhatsApp: TBD (Twilio / 360dialog / Meta Cloud API)

## Goals / Non-Goals

**Goals:**
- Build a production-ready multi-tenant SaaS that can onboard real paying businesses
- WhatsApp-first booking experience with AI-powered conversational agent
- Business dashboard with full appointment and configuration management
- Super admin panel for platform operations and business onboarding
- Subscription billing via PayPlus
- Full i18n with RTL support (Hebrew, Arabic, English)
- Smart scheduling engine that handles real-world complexity (parallel capacity, staff, breaks, holidays)

**Non-Goals:**
- Native mobile apps (web-first, PWA later if needed)
- Walk-in queue management / physical queue displays (appointments only for v1)
- Inventory or POS features
- Multi-country tax/compliance (Israel-focused for v1)
- Video consultations or telehealth
- Integration with external calendar systems (Google Calendar, Outlook) in v1

## Decisions

### 1. Monorepo structure with Turborepo

**Decision:** Single monorepo with Turborepo for build orchestration.

```
/
├── apps/
│   ├── web/          # Next.js app (booking pages, business dashboard, super admin)
│   └── api/          # Express API server
├── packages/
│   ├── db/           # Supabase client, migrations, types
│   ├── shared/       # Shared types, utils, validation schemas (Zod)
│   ├── i18n/         # Translation files and i18n utilities
│   └── ui/           # Shared UI components (shadcn/ui based)
└── services/
    └── whatsapp-agent/ # WhatsApp webhook handler + AI agent
```

**Why over separate repos:** Shared types between frontend/backend eliminate drift, single CI/CD pipeline, easier refactoring across boundaries.

### 2. Supabase for auth + database + realtime, Express for business logic

**Decision:** Use Supabase for PostgreSQL hosting, authentication (phone OTP for customers, email/password for business owners), Row-Level Security for tenant isolation, and realtime subscriptions for live dashboard updates. Keep business logic in a dedicated Express API server rather than Supabase Edge Functions.

**Why Express over Supabase Edge Functions:** Complex scheduling logic, WhatsApp webhook handling, and PayPlus integration need a full server runtime. Supabase Edge Functions have cold start and execution time limitations. Express gives full control.

**Why Supabase over raw PostgreSQL:** Built-in auth with phone OTP (critical for customer identification via WhatsApp), realtime subscriptions for live appointment updates on dashboard, RLS for multi-tenant security, hosted on Supabase's infra with option to self-host later.

### 3. Multi-tenancy via Row-Level Security (RLS)

**Decision:** Shared database with RLS policies. Every tenant-scoped table has a `business_id` column. RLS policies enforce that queries only return data belonging to the authenticated user's business.

**Why over schema-per-tenant:** Simpler operations, easier migrations, lower cost. RLS provides strong isolation without the operational overhead of managing hundreds of schemas.

**Data model core tables:**
- `businesses` — tenant config, profile, branding
- `business_members` — staff/owners linked to a business (with roles)
- `services` — services offered by a business (name, duration, price, capacity)
- `working_hours` — weekly schedule per business/staff
- `breaks` — break periods, holidays
- `appointments` — the core booking records
- `customers` — customer profiles (phone-based identity)
- `subscriptions` — business subscription plans and status
- `notifications_log` — sent messages tracking

### 4. WhatsApp integration via Meta Cloud API

**Decision:** Start with Meta's WhatsApp Cloud API directly (free tier for first 1,000 conversations/month, then pay-per-conversation).

**Why over Twilio:** Lower cost for Israeli market, direct API without middleman markup, sufficient for v1 scale. Can migrate to Twilio later if multi-channel (SMS) is needed.

**Architecture:**
- Webhook endpoint in the `whatsapp-agent` service receives incoming messages
- Messages are processed by an AI agent (Claude API) that understands intent (book, reschedule, cancel, check availability)
- Agent maintains conversation state in Redis/memory for multi-turn flows
- Outbound messages (reminders, confirmations) sent via Cloud API

### 5. AI agent powered by Claude API

**Decision:** Use Claude API (Haiku for speed/cost) for the WhatsApp conversational agent.

**Why Claude:** Excellent multilingual support (Hebrew, Arabic, English), strong instruction-following for structured booking flows, reasonable pricing with Haiku model.

**Agent flow:**
1. Customer sends WhatsApp message → webhook
2. System identifies customer by phone number, loads business context
3. Claude processes message with system prompt containing: business services, available slots, booking rules, language preference
4. Agent responds with structured actions (show_slots, create_booking, cancel_booking) + natural language response
5. Actions are executed against the scheduling engine API

### 6. Next.js app with route-based multi-tenant UI

**Decision:** Single Next.js app serving all three interfaces via route segmentation:

- `/b/[slug]` — Public booking page (SSR for SEO)
- `/dashboard` — Business owner dashboard (CSR, auth-gated)
- `/admin` — Super admin panel (CSR, auth-gated)

**Why single app over three apps:** Shared components (UI kit, i18n, auth), single deployment, simpler infrastructure. Route-based code splitting keeps bundles separate.

### 7. i18n with next-intl + RTL via Tailwind CSS logical properties

**Decision:** Use `next-intl` for translation management with JSON translation files. RTL support via Tailwind CSS logical properties (`ps-4` instead of `pl-4`, `ms-2` instead of `ml-2`) and `dir="rtl"` attribute.

**Why next-intl:** Purpose-built for Next.js, supports server components, handles pluralization and formatting for all three target languages.

### 8. PayPlus for subscription billing

**Decision:** Integrate PayPlus API for recurring subscription billing. Businesses choose a plan during onboarding, PayPlus handles payment collection.

**Plans (suggested tiers):**
- **Starter** — 1 staff member, up to 100 appointments/month, WhatsApp basic
- **Professional** — Up to 5 staff, unlimited appointments, WhatsApp AI agent, analytics
- **Business** — Unlimited staff, priority support, custom branding, API access

### 9. Scheduling engine as a pure logic module

**Decision:** Build the scheduling engine as a stateless, testable module in `packages/shared` that calculates availability given inputs (working hours, breaks, existing appointments, service duration, capacity).

**Why pure module:** Enables thorough unit testing of complex scheduling logic independently of database or HTTP layers. Both the API and WhatsApp agent consume the same engine.

**Key scheduling features:**
- Parallel capacity (e.g., 3 barber chairs = 3 simultaneous appointments)
- Per-service duration and buffer time
- Per-staff or business-wide working hours
- Break times and holiday support
- Minimum advance booking time and maximum future booking window
- Waitlist when fully booked

## Risks / Trade-offs

- **[WhatsApp Business verification delay]** → Meta requires business verification for Cloud API. Mitigation: Start verification process early; use test numbers during development.
- **[AI agent hallucination / wrong bookings]** → Claude might misunderstand customer intent. Mitigation: Structured output with confirmation step before creating bookings; always ask "Confirm appointment for X at Y?" before finalizing.
- **[RTL complexity]** → Hebrew/Arabic RTL layouts are notoriously tricky. Mitigation: Use Tailwind logical properties from day one, test RTL early and often, use shadcn/ui which has good RTL community support.
- **[Multi-tenant data leaks]** → RLS misconfiguration could expose data across tenants. Mitigation: Comprehensive RLS tests, always use `business_id` scoping, audit queries regularly.
- **[PayPlus API limitations]** → PayPlus may have API gaps for subscription management. Mitigation: Build a subscription state machine in our DB; use PayPlus for payment collection only, not as source of truth for subscription state.
- **[Scale bottleneck on scheduling engine]** → Slot availability calculations could be expensive for busy businesses. Mitigation: Cache available slots with short TTL, invalidate on booking changes.

## Open Questions

1. **WhatsApp number setup** — Should each business have its own WhatsApp number, or should all businesses share a single platform number with routing? (Single number is simpler to start; per-business numbers feel more professional)
2. **Appointment modification policy** — Should businesses define cancellation/reschedule windows (e.g., "cancel up to 2 hours before")? Likely yes, but need to decide on defaults.
3. **No-show handling** — Should the system track no-shows and potentially flag or block repeat offenders? Useful feature but adds complexity.
4. **Staff-level scheduling** — Should v1 support per-staff calendars, or treat the business as a single entity with N capacity? Per-staff is more useful but more complex.
