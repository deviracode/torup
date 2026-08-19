# WhatsApp Bot Appointment Timezone Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the WhatsApp bot from reporting appointment times in raw UTC instead of Israel local time when a customer asks about their upcoming appointments.

**Architecture:** `list_appointments`, the tool Claude calls to look up a customer's bookings, currently hands Claude raw UTC timestamps straight from the DB with zero formatting. Format them into Israel-local, language-appropriate `date`/`time` strings before returning — matching the exact locale/timezone pattern already used everywhere else in this codebase — and drop the raw timestamp fields entirely so there's nothing left for Claude to misread.

**Tech Stack:** TypeScript, Vitest, Supabase (`@torup/db`).

Full background/rationale: `docs/superpowers/specs/2026-08-19-whatsapp-bot-appointment-timezone-fix-design.md`.

---

### Task 1: Format appointment times before returning them to Claude

**Files:**
- Create: `services/whatsapp-agent/src/__tests__/tool-executor.test.ts`
- Modify: `services/whatsapp-agent/src/tool-executor.ts`

- [ ] **Step 1: Write the failing tests**

Create `services/whatsapp-agent/src/__tests__/tool-executor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSingle, mockOrder } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockOrder: vi.fn(),
}));

vi.mock("@torup/db", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "customers") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      // table === "appointments"
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () => ({
                gte: () => ({
                  order: mockOrder,
                }),
              }),
            }),
          }),
        }),
      };
    },
  }),
}));

import { executeTool } from "../tool-executor.js";

describe("executeTool > list_appointments", () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockOrder.mockReset();
    mockSingle.mockResolvedValue({ data: { id: "cust-1" } });
  });

  it("converts a UTC start_time to Israel local time (summer/DST, UTC+3)", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-08-07T11:00:00+00:00",
          end_time: "2026-08-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");
    const parsed = JSON.parse(result);

    expect(parsed[0].time).toBe("14:00");
  });

  it("converts a UTC start_time to Israel local time (winter/standard, UTC+2)", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-01-07T11:00:00+00:00",
          end_time: "2026-01-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");
    const parsed = JSON.parse(result);

    expect(parsed[0].time).toBe("13:00");
  });

  it("does not include any raw start_time or end_time field in the response", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-08-07T11:00:00+00:00",
          end_time: "2026-08-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");

    expect(result).not.toContain("start_time");
    expect(result).not.toContain("end_time");
  });

  it("resolves service_name by language, falling back to name_he when the localized field is null", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-08-07T11:00:00+00:00",
          end_time: "2026-08-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const enResult = JSON.parse(
      await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en")
    );
    expect(enResult[0].service_name).toBe("Haircut");

    const arResult = JSON.parse(
      await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "ar")
    );
    expect(arResult[0].service_name).toBe("תספורת"); // name_ar is null, falls back to name_he
  });

  it("still returns the no-appointments message when there are none", async () => {
    mockOrder.mockResolvedValue({ data: [] });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");

    expect(result).toBe("No upcoming appointments.");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @torup/whatsapp-agent test -- tool-executor`
Expected: FAIL — the current implementation returns raw `start_time`/`end_time` via `JSON.stringify(appointments)`, so `parsed[0].time` is `undefined` (not `"14:00"`/`"13:00"`), and the "does not include raw start_time" test fails since the raw field is present.

- [ ] **Step 3: Implement the fix**

In `services/whatsapp-agent/src/tool-executor.ts`, find:

```ts
      if (!appointments || appointments.length === 0) return "No upcoming appointments.";
      return JSON.stringify(appointments);
    }
```

Replace with:

```ts
      if (!appointments || appointments.length === 0) return "No upcoming appointments.";

      const locale = language === "he" ? "he-IL" : language === "ar" ? "ar" : "en";
      const formatted = appointments.map((apt) => {
        const startDate = new Date(apt.start_time);
        const service = apt.services as unknown as {
          name_he: string; name_ar: string | null; name_en: string | null;
        } | null;
        const serviceName =
          language === "ar" && service?.name_ar ? service.name_ar :
          language === "en" && service?.name_en ? service.name_en :
          service?.name_he ?? "";
        return {
          id: apt.id,
          date: startDate.toLocaleDateString(locale, {
            weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
          }),
          time: startDate.toLocaleTimeString(locale, {
            hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
          }),
          status: apt.status,
          service_name: serviceName,
        };
      });
      return JSON.stringify(formatted);
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @torup/whatsapp-agent test -- tool-executor`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Run the full whatsapp-agent test suite to confirm no regression**

Run: `pnpm --filter @torup/whatsapp-agent test`
Expected: PASS — all existing tests plus the new file.

- [ ] **Step 6: Run the full monorepo build**

Run: `pnpm build`
Expected: all 7 packages build successfully, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add services/whatsapp-agent/src/tool-executor.ts services/whatsapp-agent/src/__tests__/tool-executor.test.ts
git commit -m "$(cat <<'EOF'
fix(whatsapp-agent): convert appointment times to Israel local time before Claude sees them

list_appointments returned raw UTC timestamps straight from the DB with
no formatting, so the bot reported appointment times in UTC instead of
Israel local time (e.g. a 14:00 appointment reported as "11:00"). Now
formats date/time with timeZone: "Asia/Jerusalem" before returning,
matching the pattern already used everywhere else in the codebase —
and drops the raw timestamp fields so there's nothing left to misread.
EOF
)"
```

---

## Verification

1. `pnpm --filter @torup/whatsapp-agent test` — full suite passes.
2. `pnpm build` — full monorepo build passes.
3. Manual check (optional, if a local dev environment with real credentials is available): run the whatsapp-agent locally, book a test appointment, and ask the bot "when is my appointment?" — confirm the reported time matches the actual Israel-local appointment time, not a UTC-shifted one.

## Explicitly out of scope

- Any other tool or formatting path — confirmed during investigation that `list_appointments` is the only site with this bug.
- Localizing `status` values or fixing pre-existing hardcoded-`"he-IL"` inconsistencies noted elsewhere in the codebase during investigation — unrelated to this bug.
