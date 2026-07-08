# SaaS Tenant Isolation & Layered Architecture — Design

**Date:** 2026-07-08
**Status:** Draft — awaiting review
**Driving goals:** (1) onboard many businesses safely, (2) codebase maintainability, (3) stop trusting client-supplied `businessId`.

---

## Problem Statement

The app already has multi-tenancy at the data layer (a `businesses` tenant table, `business_id` FKs, and RLS policies), but the runtime does not rely on it:

1. **RLS is bypassed everywhere.** All 16 API route files use `createServiceClient()` (service-role key), which bypasses RLS. Tenant isolation therefore depends on every query manually adding `.eq("business_id", businessId)`. A single omission leaks another tenant's data. RLS exists but is effectively decorative at runtime.
2. **`businessId` is client-supplied.** Routes are nested `/api/businesses/:businessId/...`. `requireBusinessAccess` checks the URL id equals the user's own business, but the URL id is still a trust input. This is the user's stated top concern: "another customer can use another customer's id."
3. **No layering.** Route handlers combine HTTP parsing, business logic (capacity checks, status transitions), raw Supabase queries, cache invalidation, and notification fan-out. A partial `services/` directory exists but is applied inconsistently.
4. **No domain models.** Data flows as raw Supabase row objects straight to JSON. `packages/shared` has good Zod schemas and a scheduling engine, but entities (Appointment, Service, Business, Customer) are not modeled in one place.
5. **One-business-per-user bug.** `middleware/auth.ts:53` calls `.single()` on `business_members`; a user with 0 or >1 memberships errors.

---

## Target Architecture

### Section 1 — Three request contexts, three client strategies

The core security idea: authenticated requests must run **under the user's identity so Postgres RLS enforces tenancy**, instead of service-role + hand-written filters.

| Context | Who | Supabase client | Tenant enforcement |
|---|---|---|---|
| Authenticated (dashboard/staff) | Logged-in owner/staff | **User client** (JWT-scoped, RLS ON) | RLS via `business_id` — cannot cross tenants |
| Public booking | Anonymous customer | Anon client, RLS ON, tightly scoped | Explicit `business_id` from validated slug; write-only INSERT |
| System / internal | Cron, webhooks, agent | Service-role + `x-internal-secret` | Explicit `business_id` in code |

Consequence: forging `:businessId` in the URL yields RLS denial / empty results, not another tenant's data. The URL id becomes a label, not a trust boundary.

### Section 2 — Layered structure (controller → service → repository)

Per-module layout, `appointments` as the reference:

```
apps/api/src/
  routes/appointments.ts          # CONTROLLER: parse req, call service, shape response. No SQL, no business logic.
  modules/appointments/
    appointment.service.ts        # BUSINESS LOGIC: capacity rules, status transitions, notification fan-out
    appointment.repository.ts     # DATA ACCESS: every supabase query for appointments
  lib/
    supabase.ts                   # createUserClient(jwt), createServiceClient(), createAnonClient()
    request-context.ts            # builds { supabase, businessId, userId, role } per request
```

Rules:
- Controllers never import supabase.
- Repositories never import express or touch `req`.
- Services never build SQL or touch `req`; they take a repo + context, return domain objects or throw `AppError`.
- The repository receives the **already-scoped client** from request context. A repo method (`findByDay(day)`) does not take `businessId` — RLS + the user client guarantee scope. This structurally removes the "forgot the `.eq`" bug class.

### Section 3 — Domain models & entities

- **`packages/shared/src/domain/`** holds entity types + pure logic (extends existing `scheduling/`, `schemas/`). Add `Appointment`, `Service`, `Business`, `Customer` as explicit types with computed helpers (e.g. `isActive()`, localized-name resolver).
- Repositories map DB rows → domain objects via mappers (`toAppointment(row)`). Services speak domain; controllers serialize domain → DTO.
- Zod schemas (already in `shared/schemas`) validate inbound DTOs at the controller edge.
- One place defines what an Appointment *is*, instead of every route re-deriving it from a row shape.

### Section 4 — Tenant isolation hardening (Phase 1, dashboard-first)

1. Add `createUserClient(accessToken)` to `@torup/db` — sets `global.headers.Authorization: Bearer <jwt>` so RLS runs as the user. (`packages/db/src/client.ts` currently does not pass a per-request token; this is a small, well-defined addition.)
2. `requireAuth` builds a `RequestContext` carrying the user client + resolved `businessId` + role.
3. Authenticated routes switch from `createServiceClient()` → context user client. Manual `.eq("business_id")` filters become redundant; kept temporarily as belt-and-suspenders, removed once RLS is verified.
4. `requireBusinessAccess` remains as a fast 403 but is **no longer the security boundary** — RLS is.
5. Fix the `.single()` membership bug (`auth.ts:53`): tolerate 0/many memberships (pick the URL-matched membership; 403 if none match).

### Section 5 — Public booking lockdown (Phase 4)

- Public routes resolve business via **slug**, server-side, into `business_id` — never trust a client-sent id.
- Anon client only. Audit RLS public policies: allow `SELECT` of active-business data and write-only `INSERT` of `pending` appointments; ensure **no anon UPDATE/DELETE and no cross-tenant SELECT**.
- Rate-limit and validate that the slug→business lookup returns an active business.

### Section 6 — Phasing

| Phase | Scope | Ships |
|---|---|---|
| **1** | Tenant isolation: user-client + RLS enforcement, harden middleware, fix `.single()` bug | Security fix, dashboard |
| **2** | Layer `appointments` as reference (controller/service/repo + domain model) | Pattern established |
| **3** | Migrate remaining 15 routes to the pattern, incrementally | Consistency |
| **4** | Public booking hardening | Anon surface locked |

Each phase becomes its own implementation plan (this spec covers architecture; plans come later).

---

## Non-Goals (YAGNI)

- Multi-business-per-user with an "active business" switcher (URL model kept; only the `.single()` crash is fixed).
- Schema-per-tenant or database-per-tenant isolation (shared-schema + RLS is sufficient).
- Rewriting all 16 routes at once (incremental migration in Phase 3).
- Changing the public URL scheme (`/api/businesses/:businessId/...` stays).

---

## Risks & Mitigations

- **RLS gaps**: some tables may lack the exact policy the user client needs (e.g. members SELECT/UPDATE beyond current policies). Phase 1 includes an RLS policy audit against the full set of authenticated operations before removing manual filters.
- **Service-role code paths that legitimately need cross-tenant reads** (internal cron, google-calendar sync): these stay on service-role and are explicitly enumerated, not migrated to the user client.
- **Cache keys** (`appts:${businessId}:*`) already namespace by business; unaffected by the client switch.
