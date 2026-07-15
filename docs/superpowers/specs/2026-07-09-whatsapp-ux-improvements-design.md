# WhatsApp UX Improvements — Design Spec

**Date:** 2026-07-09  
**Status:** Approved

---

## Overview

Four improvements to the WhatsApp customer-facing bot:

1. Personalized welcome messages (new vs. returning customers)
2. Smart booking intent — parse natural language booking requests and route intelligently with availability fallback
3. Remove edit/reschedule mechanism
4. Cancel appointments → redirect customer to manager's WhatsApp

---

## 1. Welcome Messages

### New Customer (no name in DB)

Send a language-aware greeting and ask for their name before showing the menu.

| Language | Message |
|----------|---------|
| Hebrew | היי! איזה כיף שפנית אלינו 💕\n\nלפני שנתחיל, אשמח לדעת איך קוראים לך? 🌷 |
| Arabic | أهلاً! يسعدنا تواصلك معنا 💕\n\nقبل ما نبدأ، شو اسمك؟ 🌷 |

Customer replies → name saved to session + DB → main menu shown with personalized greeting.

### Returning Customer (name already in DB)

Skip the name-ask. Show the main menu immediately with a personalized header.

| Language | Message |
|----------|---------|
| Hebrew | היי {name} 🤍\n\nאיזה כיף שפנית לבוט של {businessName}!\n\nאפשר לבחור אחת מהאפשרויות: |
| Arabic | أهلاً {name} 🤍\n\nيسعدنا تواصلك مع {businessName}!\n\nاختر من الخيارات: |

### Implementation Touch Points

- `ASK_NAME` constant → convert to per-language map `ASK_NAME_I18N`
- `sendMainMenu()` in `index.ts` → add optional `customerName` param; inject into greeting text when present
- No DB schema changes; customer name is already fetched at session start

---

## 2. Smart Booking Intent

### Goal

When a customer sends a natural-language booking request (e.g., "I want an appointment Thursday at 8:00"), the bot validates availability immediately and routes the customer to the right step — instead of just showing the generic booking menu.

### Entry Gate

A new function `handleSmartBookingEntry(session, message, businessContext)` in `index.ts` is called **before** the Claude agent call for every non-button, non-flow-continuation message. It returns `true` if it handled the message (Claude call skipped) or `false` to fall through to Claude.

### Routing Logic

```
Run extractBookingIntent(message)
│
├─ confidence = "low"  →  fall through to Claude (existing behavior)
│
└─ confidence = "high"
   │
   ├─ service matched + date + time_hour present
   │   Check slot at time_hour on date
   │   ├─ slot available  →  set session to booking flow, skip to confirm step
   │   └─ slot unavailable
   │       Send: "{time} לא פנוי 😔" (just that line, nothing else)
   │       ├─ slots exist in same period (morning/noon/evening)  →  sendTimePeriodOrSlots for that period
   │       ├─ no slots that period, but other periods exist  →  show period buttons for the day
   │       └─ no slots at all that day  →  findNextAvailableDates → show date picker
   │           └─ no dates in 14 days  →  send i18n.noDates
   │
   ├─ service matched + date, no time_hour
   │   →  sendTimePeriodOrSlots for that date (skip to time selection)
   │
   ├─ service matched, no date
   │   →  enter booking flow at date selection step
   │
   └─ no service matched (but high confidence booking intent)
       →  enter booking flow from top (service selection)
```

### Fallback Message (unavailable time)

- **Hebrew:** "השעה {time} תפוסה אצלנו 🙈 אבל אל תדאגו, יש לנו עוד אפשרויות!"
- **Arabic:** "للأسف الساعة {time} محجوزة 🙈 بس عنا خيارات ثانية!"

Warm and friendly — no mention of other customers or reason for unavailability. The available alternatives follow immediately as WhatsApp buttons/list.

### Time Period Grouping (unchanged)

- Morning: 06:00–11:59
- Noon: 12:00–15:59
- Evening: 16:00–23:59

Uses existing `groupTimeSlots`, `sendTimePeriodOrSlots`, and `findNextAvailableDates` — no changes to these functions.

---

## 3. Remove Edit/Reschedule

The in-bot reschedule mechanism is removed entirely.

**Changes:**
- Delete `reschedule_booking` tool definition from `tools.ts`
- Delete `reschedule_booking` handler from `tool-executor.ts`
- Remove from `agentTools` array in `agent.ts`

No UI button changes needed — reschedule was only reachable via Claude tool call, not a menu button.

---

## 4. Cancel → Redirect to Manager

Instead of the bot handling cancellations, customers are redirected to message the manager directly on WhatsApp.

**Changes:**
- Delete `cancel_booking` tool definition from `tools.ts`
- Delete `cancel_booking` handler from `tool-executor.ts`
- Remove from `agentTools` array in `agent.ts`
- Add `managerPhone: string` to `BusinessContext` interface in `agent.ts`
- Fetch manager phone when building business context in `index.ts` (already available — same number used for approval request messages)
- Update Claude system prompt to instruct: if customer mentions cancellation → reply with manager WhatsApp link only

**Cancel redirect message:**

| Language | Message |
|----------|---------|
| Hebrew | כדי לבטל תור, שלחו הודעה ישירות למנהל/ת: https://wa.me/{managerPhone} |
| Arabic | لإلغاء موعد، تواصل مباشرة مع المدير: https://wa.me/{managerPhone} |

The "Cancel" button in the main menu (`menu_cancel`) already sends "I want to cancel an appointment" to Claude — Claude now replies with the redirect message instead of calling a tool.

---

## Files Changed

| File | Change |
|------|--------|
| `services/whatsapp-agent/src/index.ts` | Add `handleSmartBookingEntry()`, update `sendMainMenu()`, add `ASK_NAME_I18N`, fetch managerPhone for context |
| `services/whatsapp-agent/src/agent.ts` | Add `managerPhone` to `BusinessContext`, update system prompt for cancel redirect |
| `services/whatsapp-agent/src/tools.ts` | Remove `cancel_booking` and `reschedule_booking` definitions |
| `services/whatsapp-agent/src/tool-executor.ts` | Remove `cancel_booking` and `reschedule_booking` handlers |
| `services/whatsapp-agent/src/intent.ts` | No changes |

---

## Out of Scope

- Changes to the booking flow steps themselves (date picker, time list, confirm screen)
- Changes to manager-facing flows
- New WhatsApp templates
