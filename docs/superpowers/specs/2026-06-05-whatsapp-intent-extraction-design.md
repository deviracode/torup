# WhatsApp Intent Extraction — Design Spec
**Date:** 2026-06-05

## Problem

Customers currently go through 5–6 steps to book even when their first message contains everything needed (service, date, time). Example:

> "مرحبا في مجال لدور قص شعر ب 25.7 عالخمسه بدنا نكون جاهزات"
> (Hello, I'd like a haircut on July 25 at 5pm, we want to be ready — multiple people)

The agent currently ignores this intent and drops them into the full menu flow.

## Goal

Parse structured booking intent from free-text messages and jump the customer directly to the appropriate step, skipping steps they've already answered. Support Arabic, Hebrew, English, and dialect mixing.

---

## Section 1: Intent Extraction

A new function `extractBookingIntent(text, services, language, todayDate)` in `services/whatsapp-agent/src/intent.ts`.

**Calls:** `claude-haiku-4-5` via `@anthropic-ai/sdk`

**Input to Claude:**
- Today's date (for resolving relative/partial dates like "25.7")
- Business service list as compact rows: `id|name_ar|name_he|name_en`
- Raw customer message

**Output (JSON):**
```ts
{
  service_id: string | null,   // matched to actual service ID from the list
  date: string | null,         // YYYY-MM-DD, fully resolved
  time_hour: number | null,    // 0–23, smart-defaulted (e.g. "عالخمسه" → 17)
  party_size: number,          // defaults to 1; detected from plural phrasing
  confidence: "high" | "low"  // low = agent falls back to normal menu
}
```

**Confidence rules:**
- `high`: service is matched AND at least one of date/time is extracted
- `low`: service unmatched, contradictory signals, or message is too vague

**Only runs when:** `!interactionId && !session.booking && !session.awaitingName`
(i.e. free-text, not mid-flow, not awaiting name)

---

## Section 2: Session Pre-seeding & Flow Jump

### Name gate
If customer is new (`!session.customerName`), store extracted intent in `session.pendingIntent` and ask for name. After name is captured, resume from `pendingIntent` — customer never sees the main menu or service list.

### Jump logic
| Extracted | Jump to |
|-----------|---------|
| service + date + time | Slot availability check → confirmation screen |
| service + date | Date validated → time picker for that date |
| service only | Date picker with service pre-selected |
| nothing useful (low confidence) | Normal main menu (current behavior) |

### Slot not available
Tell the customer the slot is taken, then immediately show the `flow_quick` date picker (next available dates). Same behavior as if they had navigated there manually.

### Party size > 1
After the first booking confirms, send: "You mentioned [N] people — should I book the next slot for another person?" Chain through the same flow N−1 more times, each picking the next available slot after the previous booking's end time.

---

## Section 3: Implementation Boundaries

### New file: `services/whatsapp-agent/src/intent.ts`
- Single export: `extractBookingIntent`
- No side effects, fully testable in isolation
- Handles Claude API errors gracefully — returns `{ confidence: "low" }` on any failure so the normal flow always works as fallback

### Modified file: `services/whatsapp-agent/src/index.ts`
- Add `pendingIntent` field to session state (stored while awaiting name)
- In `handleIncomingMessage`, after name-capture block and before greeting/booking pattern checks, call `extractBookingIntent` and branch accordingly
- Resume `pendingIntent` in the name-capture completion block

### Session type change: `services/whatsapp-agent/src/session.ts`
- Add optional `pendingIntent` field to `ConversationSession`

### Dependency: `@anthropic-ai/sdk`
- Add to `services/whatsapp-agent/package.json` dependencies
- Already present in monorepo root

### Unchanged
`agent.ts`, `whatsapp-api.ts`, `templates.ts`, `webhook.ts`, all API routes, all existing button flow handlers.

---

## Behavior Summary

| Customer message | Before | After |
|-----------------|--------|-------|
| Full intent (service + date + time) | 5–6 steps | 1 step (confirmation) |
| Partial intent (service + date) | 5–6 steps | 2 steps (time → confirm) |
| Greeting only | Main menu | Main menu (unchanged) |
| Booking keyword | Service list | Service list (unchanged) |
| Ambiguous / low confidence | Claude fallback | Normal menu (unchanged) |

---

## Error Handling & Fallbacks
- Claude API timeout or error → `confidence: "low"` → normal flow, no user-visible error
- Service match is fuzzy but wrong → customer sees confirmation screen with service name → can cancel (`confirm_no`)
- Slot taken → explicit message + date picker
- Party size detected but customer only wants one → they can ignore the follow-up prompt
