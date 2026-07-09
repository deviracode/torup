# WhatsApp UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the WhatsApp bot UX with warmer welcome messages, smart booking intent fallback, removal of edit/reschedule, and cancel-to-manager redirect.

**Architecture:** All changes live in `services/whatsapp-agent/src/`. The smart fallback extends the existing `resumeFromIntent` function. The cancel redirect is handled directly in the `menu_cancel` button handler without going through Claude. No new files needed.

**Tech Stack:** TypeScript, Vitest, Anthropic SDK, Supabase

---

## File Map

| File | What changes |
|------|-------------|
| `services/whatsapp-agent/src/index.ts` | Update `ASK_NAME`, `MAIN_MENU_I18N`, `SLOT_TAKEN_MSG`; improve `resumeFromIntent` fallback; split `menu_cancel` handler; add `CANCEL_REDIRECT_MSG` |
| `services/whatsapp-agent/src/tools.ts` | Remove `cancel_booking` and `reschedule_booking` tool definitions |
| `services/whatsapp-agent/src/tool-executor.ts` | Remove `cancel_booking` and `reschedule_booking` handlers |
| `services/whatsapp-agent/src/agent.ts` | Add `managerPhone` to `BusinessContext`; update system prompt to handle free-text cancel |
| `services/whatsapp-agent/src/__tests__/whatsapp-agent.test.ts` | Add tests for new behavior |

---

## Task 1: Update welcome message strings

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Update `ASK_NAME` constant (around line 235)**

Replace:
```typescript
const ASK_NAME: Record<"he" | "ar" | "en", string> = {
  he: "שמחים שפניתם! 🙂 איך קוראים לכם? (שם מלא יעזור לבעל העסק לזהות אתכם)",
  ar: "أهلاً! 🙂 ما اسمك الكريم؟ (الاسم الكامل يساعد صاحب العمل على التعرف عليك)",
  en: "Welcome! 🙂 What's your name? (Full name helps the business owner identify you)",
};
```

With:
```typescript
const ASK_NAME: Record<"he" | "ar" | "en", string> = {
  he: "היי! איזה כיף שפנית אלינו 💕\n\nלפני שנתחיל, אשמח לדעת איך קוראים לך? 🌷",
  ar: "أهلاً! يسعدنا تواصلك معنا 💕\n\nقبل ما نبدأ، شو اسمك؟ 🌷",
  en: "Hey! So glad you reached out 💕\n\nBefore we start, what's your name? 🌷",
};
```

- [ ] **Step 2: Update `MAIN_MENU_I18N` greeting for returning customers (around line 186)**

Replace the `greeting` functions inside `MAIN_MENU_I18N`:
```typescript
const MAIN_MENU_I18N: Record<"he" | "ar" | "en", {
  greeting: (name: string | undefined, biz: string) => string;
  book: string; myAppts: string; cancel: string;
}> = {
  he: {
    greeting: (n, b) => n
      ? `היי ${n} 🤍\n\nאיזה כיף שפנית לבוט של ${b}!\n\nאני כאן כדי לעזור לך 🌺\n\nאפשר לבחור אחת מהאפשרויות:`
      : `ברוכים הבאים ל${b}! 👋\nאיך אפשר לעזור?`,
    book: "קביעת תור", myAppts: "התורים שלי", cancel: "ביטול תור",
  },
  ar: {
    greeting: (n, b) => n
      ? `أهلاً ${n} 🤍\n\nيسعدنا تواصلك مع ${b}!\n\nأنا هنا لمساعدتك 🌺\n\nاختر من الخيارات:`
      : `أهلاً بك في ${b}! 👋\nكيف يمكنني مساعدتك؟`,
    book: "حجز موعد", myAppts: "مواعيدي", cancel: "إلغاء موعد",
  },
  en: {
    greeting: (n, b) => n
      ? `Hi ${n} 🤍\n\nSo glad you reached out to ${b}!\n\nI'm here to help 🌺\n\nChoose an option:`
      : `Welcome to ${b}! 👋\nHow can I help?`,
    book: "Book Appointment", myAppts: "My Appointments", cancel: "Cancel Appointment",
  },
};
```

- [ ] **Step 3: Update `SLOT_TAKEN_MSG` to warm version (around line 268)**

Replace:
```typescript
const SLOT_TAKEN_MSG: Record<"he" | "ar" | "en", (time: string, date: string) => string> = {
  he: (t, d) => `⚠️ השעה ${t}:00 ב-${d} תפוסה. בחרו תאריך אחר:`,
  ar: (t, d) => `⚠️ الساعة ${t}:00 بتاريخ ${d} محجوزة. اختر تاريخاً آخر:`,
  en: (t, d) => `⚠️ ${t}:00 on ${d} is taken. Choose another date:`,
};
```

With:
```typescript
const SLOT_TAKEN_MSG: Record<"he" | "ar" | "en", (time: string) => string> = {
  he: (t) => `השעה ${t} תפוסה אצלנו 🙈 אבל אל תדאגו, יש לנו עוד אפשרויות!`,
  ar: (t) => `للأسف الساعة ${t} محجوزة 🙈 بس عنا خيارات ثانية!`,
  en: (t) => `${t} is taken 🙈 but we have other options!`,
};
```

- [ ] **Step 4: Run tests to make sure nothing breaks**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo test --filter=whatsapp-agent
```

Expected: all existing tests pass (string changes don't affect logic tests).

- [ ] **Step 5: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: warm up welcome message and unavailability strings"
```

---

## Task 2: Improve `resumeFromIntent` fallback cascade

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts` (lines ~800–811)

- [ ] **Step 1: Write the failing test**

Add to `services/whatsapp-agent/src/__tests__/whatsapp-agent.test.ts`:

```typescript
import { groupTimeSlots } from "../index.js";

describe("groupTimeSlots period detection", () => {
  it("puts 08:00 in morning", () => {
    const slots = [
      { time: "2026-07-10T06:00:00.000Z", label: "08:00" },
      { time: "2026-07-10T07:00:00.000Z", label: "09:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(2);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(0);
  });

  it("puts 17:00 in evening", () => {
    const slots = [{ time: "2026-07-10T14:00:00.000Z", label: "17:00" }];
    const grouped = groupTimeSlots(slots);
    expect(grouped.evening).toHaveLength(1);
    expect(grouped.morning).toHaveLength(0);
  });

  it("puts 13:00 in noon", () => {
    const slots = [{ time: "2026-07-10T10:00:00.000Z", label: "13:00" }];
    const grouped = groupTimeSlots(slots);
    expect(grouped.noon).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (these test existing logic)**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo test --filter=whatsapp-agent
```

Expected: PASS (groupTimeSlots is already correct).

- [ ] **Step 3: Replace the `!exactSlot` block in `resumeFromIntent` (around line 800)**

Find this block:
```typescript
  if (!exactSlot) {
    const dateDisplay = intent.date.slice(5).replace("-", "/");
    await sendTextMessage(businessPhoneNumberId, from, SLOT_TAKEN_MSG[lang](String(intent.time_hour), dateDisplay));
    const bf = BOOKING_FLOW_I18N[lang];
    const dates = await findNextAvailableDates(ctx.biz.businessId, intent.service_id, ctx.maxFutureDays, lang);
    if (dates.length > 0) {
      await sendButtonMessage(businessPhoneNumberId, from, `${serviceName} ✂️\n${bf.chooseDate}`,
        dates.map((d) => ({ id: `date_${d.date}`, title: d.label }))
      );
    }
    return;
  }
```

Replace with:
```typescript
  if (!exactSlot) {
    const timeLabel = `${String(intent.time_hour).padStart(2, "0")}:00`;
    await sendTextMessage(businessPhoneNumberId, from, SLOT_TAKEN_MSG[lang](timeLabel));

    const requestedPeriod: "morning" | "noon" | "evening" =
      intent.time_hour! >= 6 && intent.time_hour! < 12 ? "morning"
      : intent.time_hour! >= 12 && intent.time_hour! < 16 ? "noon"
      : "evening";

    const grouped = groupTimeSlots(slots);
    const samePeriodSlots = grouped[requestedPeriod] || [];

    if (samePeriodSlots.length > 0) {
      // Show slots in the same time period
      updateSession(from, businessPhoneNumberId, {
        booking: { step: "select_time", serviceId: intent.service_id, serviceName, date: intent.date },
      });
      await sendTimeSlotsGrouped(businessPhoneNumberId, from, serviceName, intent.date, samePeriodSlots, lang);
      return;
    }

    // Same period has no slots — show period buttons for remaining periods on this day
    // slots is guaranteed non-empty here (checked above), so there must be other periods
    updateSession(from, businessPhoneNumberId, {
      booking: { step: "select_date", serviceId: intent.service_id, serviceName, date: intent.date },
    });
    const updatedSessionForPeriods = { ...session, booking: { step: "select_date" as const, serviceId: intent.service_id, serviceName, date: intent.date } };
    await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSessionForPeriods, slots);
    return;
  }
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo test --filter=whatsapp-agent
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: cascade fallback when requested time slot is unavailable"
```

---

## Task 3: Remove reschedule and cancel tools

**Files:**
- Modify: `services/whatsapp-agent/src/tools.ts`
- Modify: `services/whatsapp-agent/src/tool-executor.ts`

- [ ] **Step 1: Remove `cancel_booking` and `reschedule_booking` from `tools.ts`**

Replace the entire file content with:
```typescript
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const agentTools: Tool[] = [
  {
    name: "list_appointments",
    description: "List upcoming appointments for the current customer.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_phone: {
          type: "string",
          description: "The customer's phone number.",
        },
      },
      required: ["customer_phone"],
    },
  },
];
```

- [ ] **Step 2: Remove `cancel_booking` and `reschedule_booking` cases from `tool-executor.ts`**

Replace the entire file content with:
```typescript
import { createClient } from "@torup/db";

function normalizePhone(p: string): string {
  return p.startsWith("972") ? "0" + p.slice(3) : p;
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function executeTool(
  toolName: string,
  input: Record<string, string>,
  businessId: string,
  language: "he" | "ar" | "en" = "he"
): Promise<string> {
  const supabase = getSupabase();

  switch (toolName) {
    case "list_appointments": {
      const { customer_phone } = input;
      const normalizedPhone = normalizePhone(customer_phone);

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", normalizedPhone)
        .single();

      if (!customer) return "No appointments found.";

      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status, services(name_he, name_ar, name_en)")
        .eq("business_id", businessId)
        .eq("customer_id", customer.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_time", new Date().toISOString())
        .order("start_time");

      if (!appointments || appointments.length === 0) return "No upcoming appointments.";
      return JSON.stringify(appointments);
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo test --filter=whatsapp-agent
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add services/whatsapp-agent/src/tools.ts services/whatsapp-agent/src/tool-executor.ts
git commit -m "feat: remove cancel_booking and reschedule_booking tools"
```

---

## Task 4: Cancel redirect — agent context and system prompt

**Files:**
- Modify: `services/whatsapp-agent/src/agent.ts`

- [ ] **Step 1: Add `managerPhone` to `BusinessContext` and update system prompt**

In `agent.ts`, update `BusinessContext` interface:
```typescript
interface BusinessContext {
  businessId: string;
  businessName: string;
  services: ServiceInfo[];
  language: "he" | "ar" | "en";
  customerPhone?: string;
  botContext?: string | null;
  managerPhone?: string;
}
```

At the end of `buildSystemPrompt`, before the closing backtick, add:
```typescript
  const cancelInstruction = ctx.managerPhone
    ? `\n- If the customer mentions cancelling or wants to cancel an appointment — reply with ONLY a short friendly note to message the manager directly: https://wa.me/${ctx.managerPhone} — do NOT call any tool.`
    : "";

  return `You are a friendly assistant for "${ctx.businessName}".
${langInstructions[ctx.language]}

Customer phone number: ${ctx.customerPhone || "unknown"}

Available services:
${serviceList}
${businessGuidelines}

Your job is to help customers:
1. View their existing appointments (use list_appointments tool)
2. Answer general questions about the business

CRITICAL RULES — THESE OVERRIDE EVERYTHING:
- You CANNOT book or schedule appointments. You have ZERO booking capability.
- If the customer mentions ANYTHING related to booking, scheduling, wanting an appointment, or asks about dates/times for a service — your ONLY allowed response is the single word: SHOW_BOOKING_MENU (no other text before or after, no explanation, no "sure", no asking for date or time).
- NEVER ask the customer what date or time they want. NEVER ask which service they want for booking purposes. The booking system handles all of that.
- NEVER confirm, summarize, repeat, or promise a booking time or date back to the customer.
- If the conversation history shows you previously discussed booking — ignore that history and still reply with ONLY: SHOW_BOOKING_MENU
- Use the customer phone number above — do NOT ask for it.
- Keep messages short — this is WhatsApp, not email.${cancelInstruction}`;
```

Note: the full return statement replaces the existing one. The only addition is `${cancelInstruction}` at the end and removing the cancel tool reference from the job list.

- [ ] **Step 2: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo test --filter=whatsapp-agent
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add services/whatsapp-agent/src/agent.ts
git commit -m "feat: add managerPhone to agent context for cancel redirect"
```

---

## Task 5: Cancel redirect — `menu_cancel` button handler

**Files:**
- Modify: `services/whatsapp-agent/src/index.ts`

- [ ] **Step 1: Add `CANCEL_REDIRECT_MSG` constant near other i18n constants (after `ALREADY_BOOKED_MSG`)**

```typescript
const CANCEL_REDIRECT_MSG: Record<"he" | "ar" | "en", (phone: string) => string> = {
  he: (p) => `כדי לבטל תור, שלחו הודעה ישירות למנהל/ת:\nhttps://wa.me/${p}`,
  ar: (p) => `لإلغاء موعد، تواصل مباشرة مع المدير:\nhttps://wa.me/${p}`,
  en: (p) => `To cancel an appointment, message the manager directly:\nhttps://wa.me/${p}`,
};
```

- [ ] **Step 2: Split the `menu_my_appointments || menu_cancel` handler (around line 1109)**

Replace:
```typescript
    if (interactionId === "menu_my_appointments" || interactionId === "menu_cancel") {
      const lang = session.language ?? "he";
      const myApptsPrompt: Record<"he" | "ar" | "en", string> = {
        he: "הראה לי את התורים שלי",
        ar: "أرني مواعيدي",
        en: "Show me my appointments",
      };
      const cancelPrompt: Record<"he" | "ar" | "en", string> = {
        he: "אני רוצה לבטל תור",
        ar: "أريد إلغاء موعد",
        en: "I want to cancel an appointment",
      };
      const prompt = interactionId === "menu_my_appointments" ? myApptsPrompt[lang] : cancelPrompt[lang];
      const response = await processMessage(session, prompt, {
        businessId: ctx.biz.businessId,
        businessName: ctx.biz.businessName,
        services: ctx.services as any,
        language: session.language,
        customerPhone: from,
        botContext: ctx.biz.botContext,
      });
      addMessage(from, businessPhoneNumberId, "user", prompt);
      addMessage(from, businessPhoneNumberId, "assistant", response);
      await sendTextMessage(businessPhoneNumberId, from, response);
      return;
    }
```

With:
```typescript
    if (interactionId === "menu_cancel") {
      const lang = session.language ?? "he";
      const managerPhone = ctx.biz.phone.replace(/[^0-9]/g, "");
      await sendTextMessage(businessPhoneNumberId, from, CANCEL_REDIRECT_MSG[lang](managerPhone));
      return;
    }

    if (interactionId === "menu_my_appointments") {
      const lang = session.language ?? "he";
      const myApptsPrompt: Record<"he" | "ar" | "en", string> = {
        he: "הראה לי את התורים שלי",
        ar: "أرني مواعيدي",
        en: "Show me my appointments",
      };
      const response = await processMessage(session, myApptsPrompt[lang], {
        businessId: ctx.biz.businessId,
        businessName: ctx.biz.businessName,
        services: ctx.services as any,
        language: session.language,
        customerPhone: from,
        botContext: ctx.biz.botContext,
        managerPhone: ctx.biz.phone.replace(/[^0-9]/g, ""),
      });
      addMessage(from, businessPhoneNumberId, "user", myApptsPrompt[lang]);
      addMessage(from, businessPhoneNumberId, "assistant", response);
      await sendTextMessage(businessPhoneNumberId, from, response);
      return;
    }
```

- [ ] **Step 3: Also pass `managerPhone` in the free-text Claude call (around line 1420)**

Find:
```typescript
  const response = await processMessage(session, text, {
    businessId: ctx.biz.businessId,
    businessName: ctx.biz.businessName,
    services: ctx.services as any,
    language: session.language,
    customerPhone: from,
    botContext: ctx.biz.botContext,
  });
```

Replace with:
```typescript
  const response = await processMessage(session, text, {
    businessId: ctx.biz.businessId,
    businessName: ctx.biz.businessName,
    services: ctx.services as any,
    language: session.language,
    customerPhone: from,
    botContext: ctx.biz.botContext,
    managerPhone: ctx.biz.phone.replace(/[^0-9]/g, ""),
  });
```

- [ ] **Step 4: Run type-check to catch any signature mismatches**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo type-check --filter=whatsapp-agent
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo test --filter=whatsapp-agent
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add services/whatsapp-agent/src/index.ts
git commit -m "feat: cancel button redirects customer to manager WhatsApp"
```

---

## Task 6: Final integration test pass

- [ ] **Step 1: Run full lint + type-check + test**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo lint type-check test --filter=whatsapp-agent
```

Expected: all green.

- [ ] **Step 2: Verify the `buildSystemPrompt` function compiles (it was refactored)**

```bash
cd /Users/adamazz1993/Desktop/torup
pnpm turbo build --filter=whatsapp-agent
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Push to deploy**

```bash
git push
```

Railway auto-deploys from the GitHub integration — no manual step needed.
