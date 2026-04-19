## 1. Project Setup & Monorepo Structure

- [x] 1.1 Initialize monorepo with Turborepo, pnpm workspaces, and TypeScript configuration
- [x] 1.2 Create `apps/web` Next.js app with TypeScript, Tailwind CSS, and shadcn/ui
- [x] 1.3 Create `apps/api` Express server with TypeScript and basic project structure
- [x] 1.4 Create `packages/shared` with Zod schemas and shared types
- [x] 1.5 Create `packages/db` with Supabase client setup and migration tooling
- [x] 1.6 Create `packages/i18n` with next-intl setup and translation file structure (he, ar, en)
- [x] 1.7 Create `packages/ui` with shadcn/ui components and RTL-aware base styles
- [x] 1.8 Create `services/whatsapp-agent` service scaffold
- [x] 1.9 Configure ESLint, Prettier, and shared tsconfig across all packages
- [x] 1.10 Set up environment variables (.env.example) for all apps/services

## 2. Database Schema & Supabase Setup

- [x] 2.1 Create Supabase project and configure connection in `packages/db`
- [x] 2.2 Create `businesses` table migration (id, slug, name, description, logo_url, cover_url, category, phone, email, address, social_links, default_language, is_active, created_at, updated_at)
- [x] 2.3 Create `business_members` table migration (id, business_id, user_id, role enum [owner, staff], created_at)
- [x] 2.4 Create `services` table migration (id, business_id, name_he, name_ar, name_en, description_he, description_ar, description_en, duration_minutes, buffer_minutes, price, max_capacity, is_active, sort_order)
- [x] 2.5 Create `working_hours` table migration (id, business_id, staff_id nullable, day_of_week, start_time, end_time, is_closed)
- [x] 2.6 Create `breaks` table migration (id, business_id, staff_id nullable, type enum [recurring, one_time], day_of_week nullable, specific_date nullable, start_time, end_time, label)
- [x] 2.7 Create `customers` table migration (id, phone, name, language_preference, created_at)
- [x] 2.8 Create `appointments` table migration (id, business_id, service_id, customer_id, staff_id nullable, start_time, end_time, status enum, notes, created_via enum [whatsapp, web, manual], created_at, updated_at)
- [x] 2.9 Create `waitlist` table migration (id, business_id, service_id, customer_id, requested_date, requested_time, status, created_at)
- [x] 2.10 Create `subscriptions` table migration (id, business_id, plan_id, status enum, trial_ends_at, current_period_start, current_period_end, payplus_subscription_id, created_at)
- [x] 2.11 Create `plans` table migration (id, name, monthly_price, yearly_price, max_staff, max_appointments_monthly, features jsonb, is_active)
- [x] 2.12 Create `notifications_log` table migration (id, business_id, customer_id, appointment_id, type, channel, template_id, status, sent_at, delivered_at, read_at, error)
- [x] 2.13 Create `booking_rules` table migration (id, business_id, min_advance_minutes, max_future_days, cancellation_window_minutes, reschedule_window_minutes)
- [x] 2.14 Implement RLS policies for all tenant-scoped tables (business_id isolation)
- [x] 2.15 Generate TypeScript types from database schema using Supabase CLI
- [x] 2.16 Create seed data script with sample business, services, and appointments

## 3. Authentication & Authorization

- [x] 3.1 Configure Supabase Auth for email/password (business owners/staff) and phone OTP (customers)
- [x] 3.2 Create auth middleware for Express API (validate Supabase JWT, extract user and business context)
- [x] 3.3 Implement role-based access control middleware (super_admin, business_owner, staff)
- [x] 3.4 Create login/register pages in Next.js with email/password form
- [x] 3.5 Create password reset flow (request + reset page)
- [x] 3.6 Implement auth context provider in Next.js with token refresh
- [x] 3.7 Create protected route wrapper for dashboard and admin routes
- [x] 3.8 Implement super admin impersonation endpoint with audit logging

## 4. i18n & RTL Infrastructure

- [x] 4.1 Configure next-intl with locale detection and routing (he default, ar, en)
- [x] 4.2 Create base translation files for common UI strings (buttons, labels, errors, navigation)
- [x] 4.3 Configure Tailwind CSS with logical properties (ps/pe/ms/me instead of pl/pr/ml/mr)
- [x] 4.4 Create RTL-aware layout components (Sidebar, PageHeader, Card) with dir attribute
- [x] 4.5 Create language picker component with flag icons
- [x] 4.6 Set up date/time formatting utilities using Intl API for all three locales

## 5. Scheduling Engine (Core Logic)

- [x] 5.1 Implement `getAvailableSlots(date, serviceId, businessId)` — core availability calculation considering working hours, breaks, holidays, existing appointments, capacity
- [x] 5.2 Implement `checkConflict(slot, serviceId, businessId)` — conflict detection with parallel capacity support
- [x] 5.3 Implement buffer time enforcement between consecutive appointments
- [x] 5.4 Implement smart slot suggestions — nearest available slots when requested time is full
- [x] 5.5 Implement appointment status state machine with valid transitions (pending → confirmed → in_progress → completed, pending → cancelled, confirmed → cancelled, confirmed → no_show)
- [x] 5.6 Write comprehensive unit tests for scheduling engine (simple availability, parallel capacity, buffer times, edge cases)
- [x] 5.7 Implement per-staff availability calculation (staff-specific hours and service assignments)

## 6. API Server — Core Endpoints

- [x] 6.1 Set up Express app with CORS, helmet, rate limiting, error handling middleware
- [x] 6.2 Create business CRUD endpoints (GET /businesses/:slug, PATCH /businesses/:id)
- [x] 6.3 Create services CRUD endpoints (GET/POST/PATCH/DELETE under /businesses/:id/services)
- [x] 6.4 Create working hours endpoints (GET/PUT /businesses/:id/working-hours)
- [x] 6.5 Create breaks/holidays endpoints (GET/POST/DELETE /businesses/:id/breaks)
- [x] 6.6 Create booking rules endpoints (GET/PUT /businesses/:id/booking-rules)
- [x] 6.7 Create staff management endpoints (GET/POST/PATCH/DELETE /businesses/:id/staff)
- [x] 6.8 Create availability endpoint (GET /businesses/:id/availability?service_id=&date=)
- [x] 6.9 Create appointments CRUD endpoints (GET/POST/PATCH under /businesses/:id/appointments)
- [x] 6.10 Create appointment status transition endpoint (PATCH /appointments/:id/status)
- [x] 6.11 Create customer endpoints (GET/POST/PATCH under /businesses/:id/customers, search by phone/name)
- [x] 6.12 Create waitlist endpoints (POST /waitlist, GET /businesses/:id/waitlist)
- [x] 6.13 Create analytics endpoints (GET /businesses/:id/analytics — metrics, charts data)
- [x] 6.14 Create super admin endpoints (GET /admin/businesses, POST /admin/businesses, PATCH /admin/businesses/:id, GET /admin/analytics)
- [x] 6.15 Add request validation with Zod schemas from packages/shared
- [x] 6.16 Write API integration tests for critical flows (create appointment, check availability, status transitions)

## 7. Business Dashboard (Next.js)

- [x] 7.1 Create dashboard layout with RTL-aware sidebar navigation (Calendar, Customers, Services, Settings, Analytics, Billing)
- [x] 7.2 Build daily calendar view component with time slots and appointment cards
- [x] 7.3 Build weekly calendar view with multi-staff column layout
- [x] 7.4 Implement appointment detail modal (view, edit status, cancel, reschedule)
- [x] 7.5 Build manual appointment creation form (service picker, customer search/create, date/time picker)
- [x] 7.6 Build customer list page with search, filtering, and customer detail view (history, notes, no-show count)
- [x] 7.7 Build services management page (list, add, edit, reorder, activate/deactivate)
- [x] 7.8 Build working hours configuration page (weekly grid with time pickers)
- [x] 7.9 Build breaks & holidays management page (recurring breaks, one-time closures, calendar view)
- [x] 7.10 Build booking rules settings page (advance time, future window, cancellation policy)
- [x] 7.11 Build staff management page (add staff, assign services, set custom hours)
- [x] 7.12 Build business profile settings page (name, logo, description, contact, social links)
- [x] 7.13 Build analytics dashboard page (appointment count, revenue, no-show rate, popular services, busiest hours charts)
- [x] 7.14 Build billing & subscription page (current plan, invoices, upgrade/downgrade)
- [x] 7.15 Implement Supabase realtime subscription for live appointment updates on calendar
- [x] 7.16 Add dashboard translation strings for Hebrew, Arabic, English

## 8. Web Booking Page

- [x] 8.1 Create SSR booking page at `/b/[slug]` with business branding (logo, name, description, cover image)
- [x] 8.2 Build service selection component (cards with name, duration, price in user's language)
- [x] 8.3 Build date picker component (calendar with available/unavailable day indicators)
- [x] 8.4 Build time slot picker component (grid of available slots fetched from availability API)
- [x] 8.5 Build customer details form (name, phone with Israeli format validation, notes)
- [x] 8.6 Build booking confirmation page (appointment summary, "Add to WhatsApp" deep link)
- [x] 8.7 Add Open Graph meta tags for booking page link previews (business name, description, logo)
- [x] 8.8 Ensure full mobile responsiveness and touch-friendly interactions
- [x] 8.9 Add booking page translation strings for Hebrew, Arabic, English

## 9. Super Admin Panel

- [x] 9.1 Create admin layout with navigation (Businesses, Analytics, Plans, System Config)
- [x] 9.2 Build business directory page (searchable table with filters: category, plan, status, subscription)
- [x] 9.3 Build business onboarding form (create business, assign plan, send owner invite)
- [x] 9.4 Build business detail/edit page (profile, config, services, hours — full edit access)
- [x] 9.5 Build subscription management controls (change plan, extend trial, pause, apply discount, manual payment)
- [x] 9.6 Build platform analytics dashboard (total businesses, appointments, revenue, growth charts)
- [x] 9.7 Build plans management page (create/edit plans, set pricing and feature limits)
- [x] 9.8 Build notification template management page (edit templates per language)
- [x] 9.9 Implement impersonation feature ("View as" business owner with audit log and banner)
- [x] 9.10 Add admin panel translation strings

## 10. WhatsApp Agent

- [x] 10.1 Set up Meta WhatsApp Cloud API webhook endpoint with signature verification
- [x] 10.2 Implement incoming message parser (extract text, phone number, business routing)
- [x] 10.3 Implement conversation state manager (Redis or in-memory with 30-min session TTL)
- [x] 10.4 Create Claude API integration with system prompt builder (business context, services, available slots, language)
- [x] 10.5 Define structured tool/function schemas for agent actions (show_services, check_availability, create_booking, cancel_booking, reschedule, list_appointments)
- [x] 10.6 Implement language detection from incoming messages (Hebrew/Arabic/English, default Hebrew)
- [x] 10.7 Implement multi-turn booking flow (greet → services → date → time → confirm → book)
- [x] 10.8 Implement appointment management flow (view appointments, reschedule, cancel)
- [x] 10.9 Implement outbound message sending via Cloud API (text messages, interactive buttons, list messages)
- [x] 10.10 Create WhatsApp message templates for reminders, confirmations, cancellations (in all 3 languages)
- [x] 10.11 Write integration tests for complete booking flow via WhatsApp agent

## 11. Notifications Engine

- [x] 11.1 Create notification scheduling service (cron job or queue-based) for appointment reminders
- [x] 11.2 Implement configurable reminder timing per business (e.g., 24h before, 2h before)
- [x] 11.3 Implement booking confirmation notification trigger (on appointment creation)
- [x] 11.4 Implement cancellation/reschedule notification trigger (on status change)
- [x] 11.5 Implement waitlist notification — notify first customer when slot opens with 15-min claim window
- [x] 11.6 Create notification template engine with variable substitution (customer_name, service, date, time, business_name)
- [x] 11.7 Implement delivery status tracking (sent, delivered, read, failed) via WhatsApp webhook status updates
- [x] 11.8 Create notification log viewer in business dashboard

## 12. PayPlus Billing Integration

- [x] 12.1 Integrate PayPlus API client (generate payment page, recurring charge, cancel subscription)
- [x] 12.2 Implement subscription creation flow (plan selection → PayPlus payment page → webhook confirmation → activate)
- [x] 12.3 Implement PayPlus webhook handler (successful payment, failed payment, cancellation)
- [x] 12.4 Implement subscription lifecycle state machine (trial → active → past_due → cancelled → expired)
- [x] 12.5 Implement plan enforcement middleware (check feature limits: max staff, max appointments/month)
- [x] 12.6 Implement invoice generation and storage (PDF or structured data accessible from dashboard)
- [x] 12.7 Implement trial expiration logic (disable booking when trial ends without payment)
- [x] 12.8 Implement plan upgrade/downgrade with proration

## 13. Deployment & Infrastructure

- [x] 13.1 Create Dockerfiles for `apps/api` and `services/whatsapp-agent`
- [x] 13.2 Configure GCP Cloud Run deployment for API server and WhatsApp agent
- [x] 13.3 Configure Vercel or GCP Cloud Run for Next.js app deployment
- [x] 13.4 Set up CI/CD pipeline (GitHub Actions: lint, type-check, test, build, deploy)
- [x] 13.5 Configure production environment variables and secrets management (GCP Secret Manager)
- [ ] 13.6 Set up domain and SSL for production (app domain + API subdomain)
- [x] 13.7 Configure Supabase production project with production RLS policies
- [x] 13.8 Set up monitoring and logging (GCP Cloud Logging, error tracking)

## 14. Testing & Quality Assurance

- [ ] 14.1 End-to-end test: business registration → configure services/hours → booking page live
- [ ] 14.2 End-to-end test: customer books via web booking page → confirmation sent → appears on dashboard
- [ ] 14.3 End-to-end test: customer books via WhatsApp → appointment created → reminder sent → completed
- [ ] 14.4 End-to-end test: super admin onboards business → business owner logs in → configures → accepts bookings
- [ ] 14.5 RTL testing: verify all pages render correctly in Hebrew and Arabic
- [ ] 14.6 Mobile responsiveness testing across booking page, dashboard, and admin panel
- [ ] 14.7 Load testing: scheduling engine with concurrent booking attempts
- [ ] 14.8 Security audit: verify RLS policies, auth flows, input validation, and no cross-tenant data leaks
