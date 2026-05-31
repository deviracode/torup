## Context

The current WhatsApp booking flow (services/whatsapp-agent + apps/api) inserts appointments with `status='confirmed'` immediately, never identifies the customer beyond a phone number, and has no per-customer cap. The `customers` table is global (unique by phone) — a customer can interact with many businesses on this platform. Appointment status is a Postgres enum: `pending, confirmed, cancelled, completed, no_show, in_progress`. Reminders fire from the dispatcher we just shipped in `fix-reminder-delivery`.

This change adds a manager approval gate, customer name capture, and a single-active cap.

## Goals / Non-Goals

**Goals:**
- Manager controls who actually gets a contested slot.
- Customers know their booking is pending and get notified on the outcome.
- Returning customers feel recognized (greeted by name, not re-asked).
- Prevent a single customer from holding multiple future bookings at one business.

**Non-Goals:**
- Multi-staff conflict resolution (still a single-staff-or-anyone model — out of scope).
- Customer-initiated rescheduling after rejection (we send a link to book again; we do not auto-rebook).
- Changing how web-booking-page creates appointments (this proposal scopes to WhatsApp; web bookings keep current behavior — flagged as Open Question).
- Reminder template overhaul (already shipped).

## Decisions

### 1. New status `pending_approval` (additive enum value)
**Why:** Reuse of `pending` is ambiguous — `pending` already means "appointment exists, customer hasn't responded to reminder yet". We need to distinguish "manager hasn't decided" from "customer hasn't confirmed".
**Alternative considered:** Repurpose `pending` and add a separate `manager_approved boolean`. Rejected — splits the truth across two columns and breaks every existing query that filters by status.
**Migration:** `ALTER TYPE appointment_status ADD VALUE 'pending_approval'`. Postgres requires this run outside a transaction; place in its own migration file.

### 2. Single-active cap enforced at insert time, not via DB constraint
**Why:** A partial unique index would work (`unique (business_id, customer_id) where status in (...) and start_time > now()`) but `now()` is not immutable, so Postgres rejects it. We enforce in application code with a `select count(*)` guard inside the same Supabase RPC / transaction.
**Cap rule:** reject new booking if customer already has any row matching `business_id=X and customer_id=Y and status in ('pending_approval','pending','confirmed') and start_time > now()`.
**Index:** `create index on appointments (business_id, customer_id, status, start_time)` to keep the guard query cheap.

### 3. WhatsApp name capture flow
**Lookup:** on every inbound message, `select id, name from customers where phone = $1`.
- **Hit + name present** → greet with name, skip ask, reuse customer_id.
- **Hit + name null/empty** → treat as "missing", ask for name once, update row.
- **Miss** → ask for name as the first conversational step, then `insert into customers (phone, name, language_preference) values (...) on conflict (phone) do update set name = excluded.name returning id`.

The bot's existing intent classifier runs *after* identification so the greeting can include the name on the very first reply for known customers.

### 4. Manager approve/reject as two atomic API endpoints
- `POST /api/businesses/:businessId/appointments/:id/approve`:
  1. Update target row `status='confirmed'`.
  2. In the same transaction, `update appointments set status='cancelled', notes = coalesce(notes,'') || '[auto-rejected: slot taken]' where business_id=:b and status='pending_approval' and id != :id and tstzrange(start_time, end_time) && tstzrange(target.start_time, target.end_time)` — collect ids of affected rows.
  3. Enqueue notifications: approval to chosen customer, `rejection_slot_taken` to each displaced applicant.
- `POST /.../reject`: simple status update to `cancelled` with optional manager note; sends a softer rejection notification (no "another customer was chosen" framing).

**Why two endpoints:** clearer audit trail and the side-effect set differs (reject one ≠ approve one).

### 5. Notification templates
Two new template ids: `approval` and `rejection_slot_taken`. Rendered through the same `renderTemplate(templateId, lang, vars)` we just hardened. Vars include `business_name`, `service_name`, `date`, `time`, and (for rejection) `rebook_url` pointing to the public booking page.

### 6. Conversation-level concurrency
Two customers may both be in `pending_approval` for the same slot — that's the whole point. The cap only applies per *customer*, not per *slot*. Manager's approve action serializes via the DB transaction in decision 4.

## Risks / Trade-offs

- **Enum migration is one-way** → Mitigation: ship migration in its own file; Postgres `ADD VALUE` is forward-compatible and cheap.
- **Web bookings still auto-confirm** → divergent behavior between channels. Flagged in Open Questions; if we don't unify, dashboard UI must explain the distinction.
- **Manager forgets to approve** → pending_approval rows pile up. Mitigation (future): scheduled job auto-cancels `pending_approval` rows older than X hours; out of scope here, just leave a TODO.
- **Cap query race**: two simultaneous bot bookings from same phone could both pass the count check. Mitigation: rely on a Postgres advisory lock keyed on `(business_id, customer_id)` for the duration of the insert. Cheap and bounded.
- **Existing appointments**: pre-existing `confirmed` rows from before deploy are unaffected; this change has no backfill.

## Migration Plan

1. Ship enum migration (`add value 'pending_approval'`) and the new index in one PR; deploy DB first.
2. Deploy API with new endpoints, cap guard, and updated WhatsApp flow.
3. Deploy dashboard with approve/reject UI.
4. No data backfill needed.
5. Rollback: revert app deploys; the enum value can stay (harmless if unused).

## Open Questions

- Should web-booking-page also use `pending_approval`, or keep auto-confirm? (Default: keep current; revisit after manager feedback.)
- After rejection, should `rebook_url` be a deep link with the original service preselected? (Default: yes, querystring `?service=<id>`.)
- Cap scope: per business or platform-wide? (Decision: per business — a customer can hold one active booking at the barber AND one at the clinic.)
