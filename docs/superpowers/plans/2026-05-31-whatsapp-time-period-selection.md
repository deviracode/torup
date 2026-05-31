# WhatsApp Time-Period Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a time-of-day period selection step (morning / noon / afternoon-evening) between date selection and time slot selection in the WhatsApp booking flow, skipping the picker when only one period has available slots.

**Architecture:** Add `"select_time_period"` to the `BookingState.step` union in `session.ts`. Extract a `sendTimePeriodOrSlots` helper in `index.ts` that either shows a period picker button message or jumps straight to slots. Add a `period_*` interaction ID handler in the main `interactionId` block.

**Tech Stack:** TypeScript, Express, WhatsApp Cloud API (button/list messages), Vitest

---

## File Map

| File | Change |
|------|--------|
| `services/whatsapp-agent/src/session.ts` | Add `"select_time_period"` to `BookingState.step` union |
| `services/whatsapp-agent/src/index.ts` | Add `sendTimePeriodOrSlots` helper; wire two existing date-resolution paths to call it; add `period_*` interaction handler |
| `services/whatsapp-agent/src/__tests__/whatsapp-agent.test.ts` | Add tests for `groupTimeSlots` (already exported from index after Task 2) and period-picker logic |

---

## Task 1: Add `select_time_period` to session type

**Files:**
- Modify: `services/whatsapp-agent/src/session.ts:7`

- [ ] **Step 1: Write the failing type-check**

Run: `cd services/whatsapp-agent && pnpm type-check`
This currently passes. After the edit in step 2 the compiler will enforce the new step is handled.

- [ ] **Step 2: Update BookingState.step union**

In `session.ts`, change line 7 from:
```ts
  step: "select_date" | "select_time" | "confirm";
```
to:
```ts
  step: "select_date" | "select_time_period" | "select_time" | "confirm";
```

- [ ] **Step 3: Verify type-check still passes**

Run: `cd services/whatsapp-agent && pnpm type-check`
Expected: no errors (the new literal is additive; nothing switches on it yet)

- [ ] **Step 4: Commit**

```bash
git add services/whatsapp-agent/src/session.ts
git commit -m "feat(whatsapp): add select_time_period booking step to session type"
```

---

## Task 2: Export `groupTimeSlots` and add `sendTimePeriodOrSlots` helper

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

The existing `groupTimeSlots` function (line 423) is currently unexported. We need to export it so tests can reach it. Then we add the new helper.

- [ ] **Step 1: Export `groupTimeSlots`**

In `index.ts`, change:
```ts
function groupTimeSlots(slots: { time: string; label: string }[]): Record<string, { time: string; label: string }[]> {
```
to:
```ts
export function groupTimeSlots(slots: { time: string; label: string }[]): Record<string, { time: string; label: string }[]> {
```

- [ ] **Step 2: Add `sendTimePeriodOrSlots` helper**

Add this function directly after the closing brace of `sendTimeSlotsGrouped` (currently ends around line 463):

```ts
async function sendTimePeriodOrSlots(
  phoneNumberId: string,
  to: string,
  businessPhoneNumberId: string,
  session: ConversationSession,
  slots: { time: string; label: string }[]
): Promise<void> {
  const grouped = groupTimeSlots(slots);

  const periodOrder: Array<keyof typeof TIME_GROUP_LABELS> = ["morning", "noon", "evening"];
  const nonEmpty = periodOrder.filter((k) => (grouped[k] || []).length > 0);

  if (nonEmpty.length === 0) return;

  if (nonEmpty.length === 1) {
    // Skip picker — go straight to the only available period's slots
    updateSession(to, businessPhoneNumberId, {
      booking: { ...session.booking!, step: "select_time" },
    });
    await sendTimeSlotsGrouped(phoneNumberId, to, session.booking!.serviceName, session.booking!.date!, grouped[nonEmpty[0]]);
    return;
  }

  // 2–3 periods available — show period picker
  updateSession(to, businessPhoneNumberId, {
    booking: { ...session.booking!, step: "select_time_period" },
  });

  const buttons = nonEmpty.map((k) => ({
    id: `period_${k}`,
    title: TIME_GROUP_LABELS[k],
  }));

  await sendButtonMessage(
    phoneNumberId,
    to,
    `${session.booking!.serviceName} ✂️\n${session.booking!.date!.slice(5).replace("-", "/")}\nבחרו חלק ביום:`,
    buttons
  );
}
```

- [ ] **Step 3: Type-check**

Run: `cd services/whatsapp-agent && pnpm type-check`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat(whatsapp): add sendTimePeriodOrSlots helper"
```

---

## Task 3: Wire date-resolution paths to use `sendTimePeriodOrSlots`

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

There are exactly **two places** where slots are fetched and `sendTimeSlotsGrouped` is called after a date is resolved. Replace both calls with `sendTimePeriodOrSlots`.

**Path A — `date_` interaction handler** (around line 715–731):

- [ ] **Step 1: Replace Path A**

Find this block (starts with `if (interactionId.startsWith("date_") && session.booking?.step === "select_date")`):

```ts
    // Date selected → show available time slots (grouped by time of day)
    if (interactionId.startsWith("date_") && session.booking?.step === "select_date") {
      const date = interactionId.replace("date_", "");
      const slots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, date);

      if (slots.length === 0) {
        await sendTextMessage(businessPhoneNumberId, from, "אין שעות פנויות בתאריך הזה 😔\nנסו תאריך אחר.");
        await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName);
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, step: "select_time", date },
      });

      await sendTimeSlotsGrouped(businessPhoneNumberId, from, session.booking.serviceName, date, slots);
      return;
    }
```

Replace with:

```ts
    // Date selected → ask time-of-day period (or skip if only one period available)
    if (interactionId.startsWith("date_") && session.booking?.step === "select_date") {
      const date = interactionId.replace("date_", "");
      const slots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, date);

      if (slots.length === 0) {
        await sendTextMessage(businessPhoneNumberId, from, "אין שעות פנויות בתאריך הזה 😔\nנסו תאריך אחר.");
        await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName);
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, date },
      });
      // Re-read session after update so sendTimePeriodOrSlots sees the stored date
      const updatedSession = { ...session, booking: { ...session.booking, date } };
      await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, slots);
      return;
    }
```

**Path B — specific-date free-text handler** (around line 540–547):

- [ ] **Step 2: Replace Path B**

Find this block inside the `if (session.booking?.step === "select_date" && session.bookingFlow === "specific" && !interactionId)` handler:

```ts
    updateSession(from, businessPhoneNumberId, {
      booking: { ...session.booking, step: "select_time", date: inputDateStr },
    });

    await sendTimeSlotsGrouped(businessPhoneNumberId, from, session.booking.serviceName, inputDateStr, dateSlots);
    return;
```

Replace with:

```ts
    updateSession(from, businessPhoneNumberId, {
      booking: { ...session.booking, date: inputDateStr },
    });
    const updatedSession = { ...session, booking: { ...session.booking, date: inputDateStr } };
    await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, dateSlots);
    return;
```

- [ ] **Step 3: Type-check**

Run: `cd services/whatsapp-agent && pnpm type-check`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat(whatsapp): wire date selection paths through time-period picker"
```

---

## Task 4: Add `period_*` interaction ID handler

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

Add the handler inside the `if (interactionId)` block, just before the `// Time selected → confirm` handler (which starts with `if (interactionId.startsWith("time_")`).

- [ ] **Step 1: Add the period handler**

Insert this block:

```ts
    // Period selected → show time slots for that period only
    if (
      (interactionId === "period_morning" || interactionId === "period_noon" || interactionId === "period_evening") &&
      session.booking?.step === "select_time_period"
    ) {
      const period = interactionId.replace("period_", "") as "morning" | "noon" | "evening";
      const slots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, session.booking.date!);
      const grouped = groupTimeSlots(slots);
      const periodSlots = grouped[period] || [];

      if (periodSlots.length === 0) {
        // Race condition: that period filled up — re-show remaining periods
        const remaining = slots;
        if (remaining.length === 0) {
          await sendTextMessage(businessPhoneNumberId, from, "אין שעות פנויות בתאריך הזה 😔\nנסו תאריך אחר.");
          updateSession(from, businessPhoneNumberId, { booking: undefined });
          await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName);
          return;
        }
        const updatedSession = { ...session };
        await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, remaining);
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, step: "select_time" },
      });

      await sendTimeSlotsGrouped(
        businessPhoneNumberId,
        from,
        session.booking.serviceName,
        session.booking.date!,
        periodSlots
      );
      return;
    }
```

- [ ] **Step 2: Type-check**

Run: `cd services/whatsapp-agent && pnpm type-check`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat(whatsapp): handle period_* interaction for time-period selection step"
```

---

## Task 5: Tests for `groupTimeSlots` and period-picker logic

**Files:**
- Modify: `services/whatsapp-agent/src/__tests__/whatsapp-agent.test.ts`

- [ ] **Step 1: Add import for `groupTimeSlots`**

At the top of the test file, after existing imports, add:

```ts
import { groupTimeSlots } from "../index.js";
```

- [ ] **Step 2: Add groupTimeSlots tests**

Append to the test file:

```ts
describe("groupTimeSlots", () => {
  it("puts slots before 12:00 into morning", () => {
    const slots = [
      { time: "2026-06-01T06:00:00+03:00", label: "06:00" },
      { time: "2026-06-01T09:30:00+03:00", label: "09:30" },
      { time: "2026-06-01T11:59:00+03:00", label: "11:59" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(3);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(0);
  });

  it("puts slots 12:00–15:59 into noon", () => {
    const slots = [
      { time: "2026-06-01T12:00:00+03:00", label: "12:00" },
      { time: "2026-06-01T15:00:00+03:00", label: "15:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(0);
    expect(grouped.noon).toHaveLength(2);
    expect(grouped.evening).toHaveLength(0);
  });

  it("puts slots 16:00+ into evening", () => {
    const slots = [
      { time: "2026-06-01T16:00:00+03:00", label: "16:00" },
      { time: "2026-06-01T20:00:00+03:00", label: "20:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(0);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(2);
  });

  it("distributes mixed slots correctly", () => {
    const slots = [
      { time: "2026-06-01T08:00:00+03:00", label: "08:00" },
      { time: "2026-06-01T13:00:00+03:00", label: "13:00" },
      { time: "2026-06-01T18:00:00+03:00", label: "18:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(1);
    expect(grouped.noon).toHaveLength(1);
    expect(grouped.evening).toHaveLength(1);
  });

  it("returns empty arrays for empty input", () => {
    const grouped = groupTimeSlots([]);
    expect(grouped.morning).toHaveLength(0);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd services/whatsapp-agent && pnpm test`
Expected: all tests pass including the new groupTimeSlots suite

- [ ] **Step 4: Commit**

```bash
git add services/whatsapp-agent/src/__tests__/whatsapp-agent.test.ts
git commit -m "test(whatsapp): add groupTimeSlots unit tests"
```

---

## Task 6: Build and deploy to Railway

- [ ] **Step 1: Build the Docker bundle**

Run from repo root:
```bash
cd services/whatsapp-agent && pnpm build:docker
```
Expected: `dist/index.js` created with no errors

- [ ] **Step 2: Verify Railway service name**

Run: `railway status`
Confirm the whatsapp-agent service is listed.

- [ ] **Step 3: Deploy**

Run from repo root:
```bash
railway up --service whatsapp-agent
```
Expected: deployment completes, service shows as active

- [ ] **Step 4: Smoke-test health endpoint**

```bash
curl https://<whatsapp-agent-railway-url>/health
```
Expected: `{"status":"ok","service":"whatsapp-agent"}`
