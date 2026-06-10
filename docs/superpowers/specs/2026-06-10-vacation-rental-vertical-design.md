# Vacation Rental Vertical — Design Notes

**Status:** In progress — paused, to be continued later.

---

## Customer Requirements Summary

A WhatsApp bot system for cabin/villa rental businesses:
- Automated lead qualification via WhatsApp
- Availability check (date-range, not time slots)
- Offer alternatives if requested date is unavailable
- Hand off qualified leads to a human sales rep
- Send media link (landing page with property photos/videos) on request
- Booking.com sync (real-time availability, enable/disable by season)

Full meeting summary: see original requirements doc.

---

## Decision: Vacation Rental Vertical within TorUp

Build as a **vacation rental vertical inside TorUp**, not a separate platform.

- Same design system
- Same platform/codebase
- Dashboard adapts by `business_type`
- Sections that can be shared are shared; rental-specific sections replace appointment-specific ones

---

## Architecture Foundation

Add `business_type` field to the `businesses` table.
- `appointment` — current default (hair salons, beauty services, etc.)
- `rental` — vacation rental properties (cabins, villas)

The frontend reads `business_type` and renders the appropriate dashboard sections.

---

## Reuse Assessment

| Component | Reusable? | Notes |
|---|---|---|
| WhatsApp agent service | ~60% | Bot infrastructure, sessions, Claude AI, language detection all reuse. Flow logic needs a rental-specific path. |
| Business/auth/billing | 100% | No changes needed |
| Appointments model | No | Replaced by date-range bookings for rental businesses |
| Services model | No | Replaced by property/unit management |
| Working hours / time slots | No | Replaced by night-by-night availability calendar |
| Customers table | 100% | Shared |
| Notifications / notifications_log | 100% | Shared |
| Dashboard design system | 100% | Same Tailwind/component library |

---

## Proposed Build Order

| # | Sub-project | Dependency |
|---|---|---|
| 1 | **Business type foundation** | None — everything depends on this |
| 2 | **Property management** | Business type foundation |
| 3 | **Date-range availability** | Property management |
| 4 | **Booking.com sync** | Date-range availability |
| 5 | **WhatsApp bot — rental flow** | Properties + availability |
| 6 | **Human handoff** | Rental bot flow |
| 7 | **Property landing page** | Can run in parallel with 5/6 |

---

## Next Steps (when resumed)

Start with sub-project 1: **Business type foundation**
- Add `business_type` to `businesses` table (migration)
- Onboarding: let new businesses choose their type
- Dashboard routing: render the right sections based on type
- Guard appointment-only routes from rental businesses and vice versa
