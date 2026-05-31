## Why

Today the WhatsApp bot creates appointments as auto-confirmed, never asks the customer's name, and has no per-customer cap — so a single phone can spam many concurrent bookings, business owners lose control over who actually gets the slot, and the dashboard shows anonymous "Customer" rows. We need a manager-in-the-loop approval flow with proper customer identification and a one-active-appointment-per-customer limit, before this becomes a real operational problem.

## What Changes

- **BREAKING**: WhatsApp-created appointments are no longer auto-confirmed. Bot replies "pending approval" and writes appointments with a new `pending_approval` status. Multiple customers may hold `pending_approval` for the same slot.
- WhatsApp bot collects the customer's name on first contact for new phones; persists to global `customers` table. Returning customers (matched by phone) are greeted by name and never asked again.
- Single active appointment cap per (business_id, customer_id): bot rejects a new booking if the customer already has any appointment in `{pending_approval, pending, confirmed}` with `start_time > now()` at that business.
- Business dashboard gains an Approve / Reject action on `pending_approval` appointments. Approving one auto-rejects every other `pending_approval` row whose time slot overlaps it.
- Notifications engine sends an approval message to the chosen customer and a rejection message (with a "pick another time" suggestion link) to the displaced applicants.

## Capabilities

### New Capabilities
*(none — all changes extend existing capabilities)*

### Modified Capabilities
- `whatsapp-agent`: collect & reuse customer name; reply "pending approval" instead of "confirmed"; enforce single-active-appointment cap before insert.
- `scheduling-engine`: introduce `pending_approval` status and overlap-rejection rule when a manager approves one of several pending applicants.
- `business-dashboard`: surface `pending_approval` appointments with Approve / Reject actions.
- `notifications-engine`: send approval and rejection notifications driven by manager action.

## Impact

- DB: `appointment_status` enum gains `pending_approval`; new index on `(business_id, customer_id, status, start_time)` to keep the cap query fast.
- API: new `POST /api/businesses/:businessId/appointments/:id/approve` and `/reject`; appointments list now includes `pending_approval`.
- WhatsApp agent: conversation flow + customer lookup updated; tool definitions for the AI agent updated.
- Dashboard UI: new pending-approval queue + action buttons.
- Notifications: two new templates (`approval`, `rejection_slot_taken`) in he/ar/en.
