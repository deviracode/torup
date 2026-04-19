## Why

The appointment and queue management market in Israel (and broader Middle East) is fragmented — most barbers, studios, gyms, clinics, and service providers still rely on phone calls, WhatsApp messages, or pen-and-paper to manage their schedules. This leads to double-bookings, no-shows, wasted time, and lost revenue. There is a clear opportunity to build a multi-tenant SaaS platform that lets any service-based business manage appointments through an AI-powered WhatsApp agent (the channel customers already use daily) combined with a web booking page and a business dashboard — all with first-class Hebrew, Arabic, and English support.

## What Changes

- **Multi-tenant SaaS platform**: A complete queue/appointment management system where each business gets its own workspace with isolated data, branding, and configuration
- **AI-powered WhatsApp agent**: Conversational booking assistant that handles appointment scheduling, rescheduling, cancellations, reminders, and waitlist management via WhatsApp — in Hebrew, Arabic, or English
- **Business dashboard**: Full management interface for business owners to configure services, working hours, staff, breaks, capacity, view/manage appointments, and see analytics
- **Public web booking page**: Each business gets a branded booking page (e.g., `app.com/b/salon-noga`) where customers can self-book without WhatsApp
- **Super admin panel**: Platform-wide management interface for onboarding businesses, managing subscriptions, monitoring usage, and administering the entire platform
- **Subscription & billing via PayPlus**: Integrated billing with PayPlus for business subscription management (monthly/yearly plans with tiered pricing)
- **Multi-language support**: Full RTL-aware i18n for Hebrew (default), Arabic, and English across all interfaces
- **Smart scheduling engine**: Handles parallel capacity (multiple chairs/rooms), service durations, buffer times, staff assignments, break times, holidays, and business hours
- **Automated reminders & notifications**: WhatsApp-based appointment reminders, confirmations, and follow-ups to reduce no-shows
- **Customer management**: CRM-lite for businesses — customer history, preferences, visit frequency, notes

## Capabilities

### New Capabilities
- `multi-tenant-core`: Multi-tenant architecture — tenant isolation, business registration, workspace management, and tenant-scoped data access
- `auth-and-users`: Authentication system for business owners, staff members, super admins, and customer identification (phone-based)
- `business-configuration`: Business profile, working hours, breaks, holidays, service definitions, staff management, capacity settings, and booking rules
- `scheduling-engine`: Core scheduling logic — availability calculation, conflict detection, parallel capacity, buffer times, waitlist, and smart slot suggestions
- `whatsapp-agent`: AI-powered conversational agent for WhatsApp — intent recognition, multi-turn booking flows, language detection, reminders, and notifications
- `web-booking-page`: Public-facing branded booking page per business — service selection, slot picker, customer details, confirmation
- `business-dashboard`: Business owner/staff dashboard — appointment calendar, daily/weekly views, manual booking, customer management, analytics
- `super-admin-panel`: Platform administration — business onboarding, subscription management, platform analytics, business editing, and system configuration
- `billing-payplus`: PayPlus integration for subscription billing — plan management, payment processing, invoice generation, subscription lifecycle
- `notifications-engine`: Centralized notification system — WhatsApp reminders, booking confirmations, cancellation notices, no-show follow-ups
- `i18n-rtl`: Internationalization framework with RTL support — Hebrew (default), Arabic, English; dynamic language switching per user/business

### Modified Capabilities
_None — this is a greenfield project._

## Impact

- **New codebase**: Full-stack TypeScript application built from scratch
- **Backend**: Node.js/Express API server with PostgreSQL (via Supabase) for data persistence, real-time subscriptions, and row-level security for tenant isolation
- **Frontend**: Next.js React application with SSR for booking pages, CSR for dashboards
- **External APIs**: WhatsApp Business API (provider TBD — Twilio, 360dialog, or Meta Cloud API), PayPlus payment gateway, Supabase Auth
- **Infrastructure**: Google Cloud Platform — Cloud Run or GKE for backend, Cloud SQL or Supabase hosted PostgreSQL, Cloud Storage for assets
- **AI/LLM**: Claude API or similar for WhatsApp agent natural language understanding and response generation
- **Security considerations**: Multi-tenant data isolation (RLS), PII handling (customer phone numbers, names), payment data (PCI compliance via PayPlus), GDPR-like privacy requirements
