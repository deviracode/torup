# WhatsApp Time-of-Day Period Selection

**Date:** 2026-05-31  
**Status:** Approved

## Problem

After a customer selects a date in the WhatsApp booking flow, all available time slots are shown at once in a grouped list message. When many slots exist across the day this is overwhelming. The fix is to ask the customer which part of the day they prefer before showing slots.

## Solution

Add a `select_time_period` step between date selection and time slot selection. After a date is picked, compute available slots, group them by period (morning / noon / afternoon-evening), and:

- **1 period has slots** → skip the picker, show that period's slots directly
- **2–3 periods have slots** → send a WhatsApp button message for period choice, then show only the chosen period's slots

## Booking Flow (updated)

```
Service → Date flow choice → Date → [Time Period] → Time Slot → Confirm
                                         ↑
                              skipped if only 1 period available
```

## Session State

Add `"select_time_period"` to the `booking.step` literal union in `session.ts`. No other session fields change — `booking.serviceId`, `booking.serviceName`, and `booking.date` are already present when this step is active.

## New Helper: `sendTimePeriodOrSlots`

Called from both date-selection paths (quick `date_` interaction and specific-date free-text). Signature:

```ts
async function sendTimePeriodOrSlots(
  phoneNumberId: string,
  from: string,
  businessPhoneNumberId: string,
  session: ConversationSession,
  slots: { time: string; label: string }[]
): Promise<void>
```

Logic:
1. Group slots with existing `groupTimeSlots`
2. Collect non-empty periods (preserving order: morning, noon, evening)
3. If 1 non-empty period → set `booking.step = "select_time"`, call `sendTimeSlotsGrouped` with that period's slots
4. If 2–3 non-empty periods → set `booking.step = "select_time_period"`, send button message with one button per non-empty period

Button IDs: `period_morning`, `period_noon`, `period_evening`  
Button labels: `☀️ בוקר`, `🌤️ צהריים`, `🌙 אחה"צ/ערב`

## New Interaction Handler

Handles `period_morning | period_noon | period_evening` when `booking.step === "select_time_period"`:

1. Assert `session.booking.date` and `session.booking.serviceId` are set
2. Re-fetch slots for the stored date + service (cheap, avoids caching complexity)
3. Filter to the selected period via `groupTimeSlots`
4. If filtered slots are empty (race condition — someone else booked) → send "אין שעות פנויות בתקופה זו" and re-run `sendTimePeriodOrSlots` with remaining slots
5. Set `booking.step = "select_time"`
6. Call `sendTimeSlotsGrouped` with the filtered slots

## Unchanged

- `groupTimeSlots` — no changes
- `sendTimeSlotsGrouped` — called with pre-filtered slots, no signature change
- All other flows (confirm, cancellation, agent, reminders)

## Deployment

After implementation, build and deploy to the Railway `whatsapp-agent` service.
