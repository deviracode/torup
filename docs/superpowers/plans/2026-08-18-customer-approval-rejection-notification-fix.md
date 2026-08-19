# Customer Approval/Rejection Notification Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop customer approval/rejection WhatsApp notifications from silently failing, and stop telling the manager they succeeded when they didn't.

**Architecture:** Switch the customer-approval notification to use its already-approved Meta template by default (bypasses the 24h freeform-message window entirely). Add the same template machinery for rejections, kept off by default since that template isn't registered in Meta yet. For the freeform path that's still in play until then, make failures visible: propagate the real `{sent, failed}` result up through `approveAppointment`/`rejectAppointment` and `handleManagerResponse` instead of discarding it, so the manager's WhatsApp confirmation message reflects what actually happened.

**Tech Stack:** Express (`apps/api`), Supabase (via `createServiceClient`), WhatsApp Cloud API, Vitest.

Full background/rationale: `docs/superpowers/specs/2026-08-18-customer-approval-rejection-notification-fix-design.md`.

---

### Task 1: Default customer-approval notifications to the approved template

**Files:**
- Modify: `apps/api/src/services/notifications.ts:287-291` (the `useTemplate` line and its comment, inside `sendApprovalNotification`)
- Modify: `apps/api/src/__tests__/approval-notifications.test.ts`

- [ ] **Step 1: Update the test mock to include the template-sending function**

In `apps/api/src/__tests__/approval-notifications.test.ts`, find:

```ts
// Stub WhatsApp so no real messages fire.
vi.mock("../services/whatsapp.js", () => ({
  sendInteractiveReminder: vi.fn(async () => null),
  sendWhatsAppMessage: vi.fn(async () => "msg-id-123"),
}));
```

Replace with:

```ts
// Stub WhatsApp so no real messages fire.
vi.mock("../services/whatsapp.js", () => ({
  sendInteractiveReminder: vi.fn(async () => null),
  sendWhatsAppMessage: vi.fn(async () => "msg-id-123"),
  sendCustomerApprovalTemplate: vi.fn(async () => "tmpl-msg-id-456"),
  sendCustomerRejectionTemplate: vi.fn(async () => "tmpl-msg-id-789"),
}));
```

(`sendCustomerRejectionTemplate` doesn't exist yet — it's added in Task 2. Adding it to the mock now is harmless since nothing calls it until then, and avoids touching this mock twice.)

- [ ] **Step 2: Add env var isolation between tests**

In the same file, find the `describe("sendApprovalNotification", () => {` block:

```ts
describe("sendApprovalNotification", () => {
  beforeEach(() => {
    insertedRows.length = 0;
  });
```

Replace with:

```ts
describe("sendApprovalNotification", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    delete process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED;
  });
```

- [ ] **Step 3: Update the existing test to explicitly force the freeform fallback**

Find:

```ts
  it("sends approval notification and logs status='sent' when WhatsApp succeeds", async () => {
    const { sendApprovalNotification } = await import("../services/notifications.js");
    const result = await sendApprovalNotification("apt-1");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].template_id).toBe("approval");
    expect(insertedRows[0].whatsapp_message_id).toBe("msg-id-123");
  });
```

Replace with (this test now specifically covers the freeform fallback, which is why the env var is forced to `"false"`):

```ts
  it("falls back to freeform text and logs status='sent' when the template is explicitly disabled", async () => {
    process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED = "false";
    const { sendApprovalNotification } = await import("../services/notifications.js");
    const result = await sendApprovalNotification("apt-1");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].template_id).toBe("approval");
    expect(insertedRows[0].whatsapp_message_id).toBe("msg-id-123");
  });

  it("uses the approved Meta template by default when the env var is unset", async () => {
    const { sendApprovalNotification } = await import("../services/notifications.js");
    const result = await sendApprovalNotification("apt-1");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].template_id).toBe("approval");
    expect(insertedRows[0].whatsapp_message_id).toBe("tmpl-msg-id-456");
  });
```

- [ ] **Step 4: Run the tests to confirm the new test fails (proves it's testing real behavior)**

Run: `pnpm --filter @torup/api test -- approval-notifications`
Expected: FAIL — the new "uses the approved Meta template by default" test fails because `insertedRows[0].whatsapp_message_id` is `"msg-id-123"` (freeform, current behavior), not `"tmpl-msg-id-456"`.

- [ ] **Step 5: Flip the default in the implementation**

In `apps/api/src/services/notifications.ts`, find:

```ts
export async function sendApprovalNotification(appointmentId: string) {
  // If the approved Meta template is enabled, use it to bypass the 24h conversation window.
  // Templates appointment_confirmed_he / appointment_confirmed_ar must be registered in
  // WhatsApp Business Manager. Enable with: WHATSAPP_APPROVAL_TEMPLATE_ENABLED=true
  const useTemplate = process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED === "true";
```

Replace with:

```ts
export async function sendApprovalNotification(appointmentId: string) {
  // Use the approved Meta template by default to bypass the 24h conversation window —
  // freeform text messages silently fail once 24h have passed since the customer's
  // last inbound message, which is unrelated to how far away their appointment is.
  // Templates appointment_confirmed_he / appointment_confirmed_ar are registered and
  // approved in WhatsApp Business Manager. Set WHATSAPP_APPROVAL_TEMPLATE_ENABLED=false
  // to force the old freeform behavior.
  const useTemplate = process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED !== "false";
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `pnpm --filter @torup/api test -- approval-notifications`
Expected: PASS — all tests in this file, including both the freeform-fallback and template-default tests.

- [ ] **Step 7: Run the full `approval.test.ts` route-level suite to confirm no regression**

Run: `pnpm --filter @torup/api test -- approval.test`
Expected: PASS. (This file's Supabase stub has no `customers`/`services`/`businesses` data, so `sendApprovalNotification`'s template branch bails out via its existing `if (customer?.phone && service)` guard and falls through to the freeform path — same as before this change, just reached via a different `useTemplate` value. No modification to this test file is needed.)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/notifications.ts apps/api/src/__tests__/approval-notifications.test.ts
git commit -m "fix(notifications): default customer approval to the approved WhatsApp template

Freeform text notifications silently fail once 24h have passed since
the customer's last inbound message — unrelated to appointment timing.
The appointment_confirmed_he/ar template is already approved in Meta
and bypasses this entirely; it was built but never turned on."
```

---

### Task 2: Add a template send path for rejection notifications (off by default)

**Files:**
- Modify: `apps/api/src/services/whatsapp.ts` (add `sendCustomerRejectionTemplate`, after `sendCustomerApprovalTemplate`)
- Modify: `apps/api/src/services/notifications.ts` (add opt-in template branch to `sendRejectionNotification`, add import)
- Modify: `apps/api/src/__tests__/approval-notifications.test.ts` (add rejection-template test)

- [ ] **Step 1: Write the failing test**

In `apps/api/src/__tests__/approval-notifications.test.ts`, find the `describe("sendRejectionNotification", () => {` block's `beforeEach`:

```ts
describe("sendRejectionNotification", () => {
  beforeEach(() => {
    insertedRows.length = 0;
  });
```

Replace with:

```ts
describe("sendRejectionNotification", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    delete process.env.WHATSAPP_REJECTION_TEMPLATE_ENABLED;
  });
```

Then, at the end of that `describe` block (after the existing "constructs rebook_url..." test), add:

```ts

  it("uses the rejection template when WHATSAPP_REJECTION_TEMPLATE_ENABLED is 'true'", async () => {
    process.env.WHATSAPP_REJECTION_TEMPLATE_ENABLED = "true";
    const { sendRejectionNotification } = await import("../services/notifications.js");
    const result = await sendRejectionNotification("apt-1", "manual");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].whatsapp_message_id).toBe("tmpl-msg-id-789");
  });

  it("stays on freeform text when WHATSAPP_REJECTION_TEMPLATE_ENABLED is unset", async () => {
    const { sendRejectionNotification } = await import("../services/notifications.js");
    const result = await sendRejectionNotification("apt-1", "manual");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].template_id).toBe("rejection_manual");
    expect(insertedRows[0].whatsapp_message_id).toBe("msg-id-123");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @torup/api test -- approval-notifications`
Expected: FAIL on the new "uses the rejection template..." test — `sendCustomerRejectionTemplate` isn't called by `sendRejectionNotification` yet, so `whatsapp_message_id` is still `"msg-id-123"` regardless of the env var. (The "stays on freeform..." test should already pass, since it matches current behavior — that's fine, it locks in the no-op default.)

- [ ] **Step 3: Add `sendCustomerRejectionTemplate` to `whatsapp.ts`**

In `apps/api/src/services/whatsapp.ts`, immediately after the closing brace of `sendCustomerApprovalTemplate` (the function ending with `return data.messages?.[0]?.id ?? null;\n}` that follows the `appointment_confirmed_he/ar` template logic), add:

```ts

/**
 * Send an approved appointment-rejected template to the customer, bypassing Meta's 24h window.
 * Uses appointment_rejected_ar for Arabic, appointment_rejected_he for all other languages.
 * Parameter order must match the approved templates: customer_name, service_name, date, time.
 *
 * Unlike the freeform rejection message, this template does not include a rebook_url —
 * whoever registers it in WhatsApp Business Manager should decide whether to add a URL
 * button component for that, and whether slot-taken vs. manual rejections need separate
 * templates (this covers both with one generic message).
 *
 * Templates must be registered and approved in WhatsApp Business Manager before this works.
 * Enable via env var: WHATSAPP_REJECTION_TEMPLATE_ENABLED=true
 */
export async function sendCustomerRejectionTemplate(
  to: string,
  params: { customerName: string; serviceName: string; date: string; time: string },
  language: string
): Promise<string | null> {
  const templateName = language === "ar" ? "appointment_rejected_ar" : "appointment_rejected_he";

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[WhatsApp] (dev mode) Customer rejection template "${templateName}" to: ${to}`, params);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.customerName },
                { type: "text", text: params.serviceName },
                { type: "text", text: params.date },
                { type: "text", text: params.time },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (customer rejection template "${templateName}") to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}
```

- [ ] **Step 4: Wire the template branch into `sendRejectionNotification`**

In `apps/api/src/services/notifications.ts`, find the import line:

```ts
import {
  sendInteractiveReminder,
  sendManagerApprovalRequest,
  sendManagerNewBookingTemplate,
  sendWhatsAppMessage,
  sendCustomerReminderTemplate,
  sendCustomerApprovalTemplate,
} from "./whatsapp.js";
```

Replace with:

```ts
import {
  sendInteractiveReminder,
  sendManagerApprovalRequest,
  sendManagerNewBookingTemplate,
  sendWhatsAppMessage,
  sendCustomerReminderTemplate,
  sendCustomerApprovalTemplate,
  sendCustomerRejectionTemplate,
} from "./whatsapp.js";
```

Then find the full `sendRejectionNotification` function:

```ts
export async function sendRejectionNotification(
  appointmentId: string,
  kind: "slot_taken" | "manual"
) {
  const templateId = kind === "slot_taken" ? "rejection_slot_taken" : "rejection_manual";
  // Inject rebook_url into vars by piggy-backing on sendAppointmentNotification:
  // it builds vars from the appointment row. We add rebook_url here through a
  // small wrapper that loads the service id and constructs the link.
  const supabase = createServiceClient();
  const { data: apt } = await supabase
    .from("appointments")
    .select("business_id, service_id")
    .eq("id", appointmentId)
    .single();
  const appUrl = process.env.APP_URL || "https://book.example";
  const rebookUrl = apt
    ? `${appUrl}/book/${apt.business_id}?service=${apt.service_id}`
    : appUrl;
  return sendAppointmentNotification(appointmentId, templateId, { rebook_url: rebookUrl });
}
```

Replace with:

```ts
export async function sendRejectionNotification(
  appointmentId: string,
  kind: "slot_taken" | "manual"
) {
  const templateId = kind === "slot_taken" ? "rejection_slot_taken" : "rejection_manual";

  // Opt-in: only active once appointment_rejected_he/ar are registered and approved
  // in WhatsApp Business Manager. Until then this falls through to freeform text
  // below, which is subject to Meta's 24h conversation-window restriction — see
  // sendApprovalNotification's comment for why that matters.
  const useTemplate = process.env.WHATSAPP_REJECTION_TEMPLATE_ENABLED === "true";
  if (useTemplate) {
    const supabase = createServiceClient();
    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "id, business_id, customer_id, start_time, " +
        "customers(id, name, phone, language_preference), " +
        "services(name_he, name_ar, name_en), " +
        "businesses(name)"
      )
      .eq("id", appointmentId)
      .single();

    if (appointment) {
      const apt = appointment as unknown as {
        id: string; business_id: string; customer_id: string; start_time: string;
        customers: { id: string; name: string; phone: string; language_preference: string };
        services: { name_he: string; name_ar: string | null; name_en: string | null };
        businesses: { name: string };
      };
      const customer = apt.customers;
      const service = apt.services;
      if (customer?.phone && service) {
        const lang = customer.language_preference || "he";
        const serviceName = lang === "ar" && service.name_ar ? service.name_ar :
          lang === "en" && service.name_en ? service.name_en : service.name_he;
        const startDate = new Date(apt.start_time);
        const date = startDate.toLocaleDateString(lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en", {
          weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
        });
        const time = startDate.toLocaleTimeString(lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en", {
          hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
        });
        const msgId = await sendCustomerRejectionTemplate(
          customer.phone,
          { customerName: customer.name, serviceName, date, time },
          lang
        );
        await logNotification({
          business_id: apt.business_id,
          customer_id: customer.id,
          appointment_id: appointmentId,
          type: templateId,
          channel: "whatsapp",
          template_id: templateId,
          status: msgId ? "sent" : "failed",
          whatsapp_message_id: msgId,
          error: msgId ? undefined : "Template send failed — check logs for Meta API error",
        });
        if (!msgId) {
          console.error(`[Notification] FAILED rejection template → ${customer.phone} | appointment ${appointmentId}`);
        }
        return { sent: !!msgId, failed: !msgId };
      }
    }
  }

  // Inject rebook_url into vars by piggy-backing on sendAppointmentNotification:
  // it builds vars from the appointment row. We add rebook_url here through a
  // small wrapper that loads the service id and constructs the link.
  const supabase = createServiceClient();
  const { data: apt } = await supabase
    .from("appointments")
    .select("business_id, service_id")
    .eq("id", appointmentId)
    .single();
  const appUrl = process.env.APP_URL || "https://book.example";
  const rebookUrl = apt
    ? `${appUrl}/book/${apt.business_id}?service=${apt.service_id}`
    : appUrl;
  return sendAppointmentNotification(appointmentId, templateId, { rebook_url: rebookUrl });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @torup/api test -- approval-notifications`
Expected: PASS — all tests, including both new rejection-template tests.

- [ ] **Step 6: Run the full api build to catch type errors**

Run: `pnpm --filter @torup/api build`
Expected: PASS, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/whatsapp.ts apps/api/src/services/notifications.ts apps/api/src/__tests__/approval-notifications.test.ts
git commit -m "feat(notifications): add opt-in template path for rejection notifications

Mirrors the approval template. Off by default since appointment_rejected_he/ar
aren't registered in Meta yet — code is ready for when they are."
```

---

### Task 3: Surface notification delivery result from approve/reject actions

**Files:**
- Create: `apps/api/src/__tests__/appointment-actions-notify.test.ts`
- Modify: `apps/api/src/services/appointment-actions.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/appointment-actions-notify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const TARGET_ID = "apt-target";
const BUSINESS_ID = "biz-1";

const { mockSendApprovalNotification, mockSendRejectionNotification } = vi.hoisted(() => ({
  mockSendApprovalNotification: vi.fn(),
  mockSendRejectionNotification: vi.fn(),
}));

vi.mock("../services/notifications.js", () => ({
  sendApprovalNotification: mockSendApprovalNotification,
  sendRejectionNotification: mockSendRejectionNotification,
}));

vi.mock("../services/google-calendar.js", () => ({
  pushAppointmentToGoogle: vi.fn(async () => {}),
}));

vi.mock("../lib/redis.js", () => ({
  cacheClear: vi.fn(async () => {}),
}));

type Apt = { id: string; business_id: string; status: string; start_time: string; end_time: string };
let store: Record<string, Apt>;

function freshStore(): Record<string, Apt> {
  return {
    [TARGET_ID]: {
      id: TARGET_ID,
      business_id: BUSINESS_ID,
      status: "pending_approval",
      start_time: "2099-01-01T10:00:00Z",
      end_time: "2099-01-01T10:30:00Z",
    },
  };
}

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table !== "appointments") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) };
      }
      const filters: { field: string; op: string; value: unknown }[] = [];
      const builder: Record<string, unknown> = {};
      const apply = (): Apt[] =>
        Object.values(store).filter((a) =>
          filters.every((f) => {
            const v = (a as Record<string, unknown>)[f.field];
            if (f.op === "eq") return v === f.value;
            if (f.op === "neq") return v !== f.value;
            if (f.op === "lt") return typeof v === "string" && v < (f.value as string);
            if (f.op === "gt") return typeof v === "string" && v > (f.value as string);
            return true;
          })
        );
      builder.select = () => builder;
      builder.eq = (field: string, value: unknown) => { filters.push({ field, op: "eq", value }); return builder; };
      builder.neq = (field: string, value: unknown) => { filters.push({ field, op: "neq", value }); return builder; };
      builder.lt = (field: string, value: unknown) => { filters.push({ field, op: "lt", value }); return builder; };
      builder.gt = (field: string, value: unknown) => { filters.push({ field, op: "gt", value }); return builder; };
      builder.single = async () => {
        const rows = apply();
        return { data: rows[0] || null, error: rows[0] ? null : { message: "not found" } };
      };
      builder.then = (resolve: (v: { data: Apt[]; error: null }) => void) => resolve({ data: apply(), error: null });
      builder.update = (patch: Record<string, unknown>) => ({
        eq: (field: string, value: unknown) => {
          for (const a of Object.values(store)) {
            if ((a as Record<string, unknown>)[field] === value) Object.assign(a, patch);
          }
          return Promise.resolve({ error: null });
        },
      });
      return builder;
    },
  }),
}));

describe("customerNotified in approve/reject results", () => {
  beforeEach(() => {
    store = freshStore();
    mockSendApprovalNotification.mockReset();
    mockSendRejectionNotification.mockReset();
  });

  it("approveAppointment returns customerNotified: true when the send succeeds", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: true, failed: false });
    const { approveAppointment } = await import("../services/appointment-actions.js");

    const result = await approveAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(true);
  });

  it("approveAppointment returns customerNotified: false when the send fails", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: false, failed: true });
    const { approveAppointment } = await import("../services/appointment-actions.js");

    const result = await approveAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(false);
    expect(result.approved).toBe(TARGET_ID);
  });

  it("approveAppointment returns customerNotified: false without throwing when the send rejects", async () => {
    mockSendApprovalNotification.mockRejectedValue(new Error("network error"));
    const { approveAppointment } = await import("../services/appointment-actions.js");

    const result = await approveAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(false);
  });

  it("rejectAppointment returns customerNotified: true when the send succeeds", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: true, failed: false });
    const { rejectAppointment } = await import("../services/appointment-actions.js");

    const result = await rejectAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(true);
    expect(result.rejected).toBe(TARGET_ID);
  });

  it("rejectAppointment returns customerNotified: false when the send fails", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: false, failed: true });
    const { rejectAppointment } = await import("../services/appointment-actions.js");

    const result = await rejectAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @torup/api test -- appointment-actions-notify`
Expected: FAIL — `result.customerNotified` is `undefined` for all cases, since `approveAppointment`/`rejectAppointment` don't return that field yet.

- [ ] **Step 3: Implement the change**

In `apps/api/src/services/appointment-actions.ts`, find (inside `approveAppointment`):

```ts
  await cacheClear(`appts:${businessId}:*`);

  // Must be awaited — on Vercel, fire-and-forget work is killed once the response is sent.
  await sendApprovalNotification(appointmentId).catch((err) =>
    console.error("[Notification] approval failed:", err)
  );
  await Promise.all(
    rejectedIds.map((id) =>
      sendRejectionNotification(id, "slot_taken").catch((err) =>
        console.error("[Notification] slot_taken rejection failed:", err)
      )
    )
  );

  // Google Calendar sync is optional — keep fire-and-forget.
  pushAppointmentToGoogle(appointmentId).catch(() => {});
  for (const id of rejectedIds) pushAppointmentToGoogle(id).catch(() => {});

  return { approved: appointmentId, rejected: rejectedIds };
```

Replace with:

```ts
  await cacheClear(`appts:${businessId}:*`);

  // Must be awaited — on Vercel, fire-and-forget work is killed once the response is sent.
  const notifyResult = await sendApprovalNotification(appointmentId).catch((err) => {
    console.error("[Notification] approval failed:", err);
    return { sent: false, failed: true };
  });
  const customerNotified = notifyResult?.sent ?? false;
  await Promise.all(
    rejectedIds.map((id) =>
      sendRejectionNotification(id, "slot_taken").catch((err) =>
        console.error("[Notification] slot_taken rejection failed:", err)
      )
    )
  );

  // Google Calendar sync is optional — keep fire-and-forget.
  pushAppointmentToGoogle(appointmentId).catch(() => {});
  for (const id of rejectedIds) pushAppointmentToGoogle(id).catch(() => {});

  return { approved: appointmentId, rejected: rejectedIds, customerNotified };
```

Then find (inside `rejectAppointment`):

```ts
  await cacheClear(`appts:${businessId}:*`);

  await sendRejectionNotification(appointmentId, "manual").catch((err) =>
    console.error("[Notification] manual rejection failed:", err)
  );

  pushAppointmentToGoogle(appointmentId).catch(() => {});

  return { rejected: appointmentId };
```

Replace with:

```ts
  await cacheClear(`appts:${businessId}:*`);

  const notifyResult = await sendRejectionNotification(appointmentId, "manual").catch((err) => {
    console.error("[Notification] manual rejection failed:", err);
    return { sent: false, failed: true };
  });
  const customerNotified = notifyResult?.sent ?? false;

  pushAppointmentToGoogle(appointmentId).catch(() => {});

  return { rejected: appointmentId, customerNotified };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @torup/api test -- appointment-actions-notify`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Run the existing route-level approval tests to confirm no regression**

Run: `pnpm --filter @torup/api test -- approval.test`
Expected: PASS. (That file's stub causes `sendApprovalNotification`/`sendRejectionNotification` to resolve `undefined` — via the real, unmocked `notifications.ts` module hitting its `if (!customer || !service || !business) return;` early exit — so `customerNotified` will resolve to `false` via the `?? false` fallback rather than throwing. The existing assertions in that file don't check `customerNotified`, so they're unaffected.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/appointment-actions.ts apps/api/src/__tests__/appointment-actions-notify.test.ts
git commit -m "feat(appointments): return customerNotified from approve/reject actions

Surfaces whether the customer notification actually sent, instead of
discarding the result. Approval/rejection itself still succeeds even
when the notification fails — this only adds visibility."
```

---

### Task 4: Honest manager-facing confirmation message on the WhatsApp button path

**Files:**
- Create: `apps/api/src/__tests__/webhook-manager-response.test.ts`
- Modify: `apps/api/src/routes/webhooks.ts`

- [ ] **Step 1: Export `handleManagerResponse` for direct testing**

In `apps/api/src/routes/webhooks.ts`, find:

```ts
async function handleManagerResponse(
  managerPhone: string,
  appointmentId: string,
  action: "approve" | "reject"
) {
```

Replace with:

```ts
export async function handleManagerResponse(
  managerPhone: string,
  appointmentId: string,
  action: "approve" | "reject"
) {
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/__tests__/webhook-manager-response.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Both must normalize to the same digit string (handleManagerResponse strips
// non-digits and compares literally — no country-code harmonization) or the
// ownership check silently rejects and the test would never reach the code
// under test.
const MANAGER_PHONE = "972501234567";
const OWNER_PHONE = "972501234567";
const APPOINTMENT_ID = "apt-1";

const { mockSendWhatsAppMessage, mockSendApprovalNotification, mockSendRejectionNotification } = vi.hoisted(() => ({
  mockSendWhatsAppMessage: vi.fn(async () => "msg-id"),
  mockSendApprovalNotification: vi.fn(),
  mockSendRejectionNotification: vi.fn(),
}));

vi.mock("../services/whatsapp.js", () => ({
  sendWhatsAppMessage: mockSendWhatsAppMessage,
}));

vi.mock("../services/notifications.js", () => ({
  sendApprovalNotification: mockSendApprovalNotification,
  sendRejectionNotification: mockSendRejectionNotification,
}));

const appointmentRow = {
  id: APPOINTMENT_ID,
  status: "pending_approval",
  business_id: "biz-1",
  businesses: { phone: OWNER_PHONE },
};

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: appointmentRow }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  }),
}));

describe("handleManagerResponse", () => {
  beforeEach(() => {
    mockSendWhatsAppMessage.mockClear();
    mockSendApprovalNotification.mockReset();
    mockSendRejectionNotification.mockReset();
  });

  it("tells the manager the customer WAS notified when the approval send succeeds", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: true, failed: false });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "approve");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "✅ התור אושר! הלקוח יקבל הודעה."
    );
  });

  it("tells the manager the customer was NOT notified when the approval send fails", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: false, failed: true });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "approve");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "✅ התור אושר, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות."
    );
  });

  it("tells the manager the customer WAS notified when the rejection send succeeds", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: true, failed: false });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "reject");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "❌ התור נדחה. הלקוח יקבל הודעה."
    );
  });

  it("tells the manager the customer was NOT notified when the rejection send fails", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: false, failed: true });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "reject");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "❌ התור נדחה, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות."
    );
  });

  it("does not throw when the notification function resolves undefined", async () => {
    mockSendApprovalNotification.mockResolvedValue(undefined);
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await expect(
      handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "approve")
    ).resolves.not.toThrow();
    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "✅ התור אושר, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות."
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @torup/api test -- webhook-manager-response`
Expected: FAIL — the current code always sends the hardcoded success message regardless of the mocked notification result, so the "was NOT notified" assertions fail (received the success text instead), and the last test throws (`result.sent` on `undefined`).

- [ ] **Step 4: Implement the change**

In `apps/api/src/routes/webhooks.ts`, find:

```ts
  if (action === "approve") {
    await supabase.from("appointments").update({ status: "confirmed" }).eq("id", appointmentId);
    await sendWhatsAppMessage(managerPhone, "✅ התור אושר! הלקוח יקבל הודעה.");
    await sendApprovalNotification(appointmentId);
  } else {
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);
    await sendWhatsAppMessage(managerPhone, "❌ התור נדחה. הלקוח יקבל הודעה.");
    await sendRejectionNotification(appointmentId, "manual");
  }
```

Replace with:

```ts
  if (action === "approve") {
    await supabase.from("appointments").update({ status: "confirmed" }).eq("id", appointmentId);
    const result = await sendApprovalNotification(appointmentId);
    const managerMsg = result?.sent
      ? "✅ התור אושר! הלקוח יקבל הודעה."
      : "✅ התור אושר, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות.";
    await sendWhatsAppMessage(managerPhone, managerMsg);
  } else {
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);
    const result = await sendRejectionNotification(appointmentId, "manual");
    const managerMsg = result?.sent
      ? "❌ התור נדחה. הלקוח יקבל הודעה."
      : "❌ התור נדחה, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות.";
    await sendWhatsAppMessage(managerPhone, managerMsg);
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @torup/api test -- webhook-manager-response`
Expected: PASS — all 5 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/webhooks.ts apps/api/src/__tests__/webhook-manager-response.test.ts
git commit -m "fix(webhooks): tell the manager honestly whether the customer was notified

handleManagerResponse previously sent a hardcoded success message
regardless of whether sendApprovalNotification/sendRejectionNotification
actually succeeded. Now reflects the real result, exported for testing."
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full api test suite**

Run: `pnpm --filter @torup/api test`
Expected: all tests pass, including the 4 new/modified test files from Tasks 1-4.

- [ ] **Step 2: Full monorepo build**

Run: `pnpm build`
Expected: all packages build successfully, no TypeScript errors.

- [ ] **Step 3: Manual dev-mode smoke check**

With `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` unset (or in a local `.env` without them, which triggers "dev mode" log-only sends in `whatsapp.ts`), start the api locally and trigger an approval via `POST /api/businesses/:businessId/appointments/:id/approve` for a `pending_approval` test appointment with a real customer/service/business row.
Expected: server log shows `[WhatsApp] (dev mode) Customer approval template "appointment_confirmed_he" to: ...` (proving the template path is now the one being taken, not the old freeform `[WhatsApp] (dev mode) To: ... Message: ...` log), and the JSON response includes `"customerNotified": true`.

---

## Explicitly out of scope (do not do these without separate confirmation)

- Registering `appointment_rejected_he`/`appointment_rejected_ar` in WhatsApp Business Manager, or deciding their final shape (one vs. two templates, URL button for the rebook link) — external, non-code prerequisite for Task 2's template branch to actually activate.
- Any dashboard UI change surfacing `customerNotified` — no toast/notification library exists in `apps/web` on this branch; introducing one is a separate decision, not part of this fix.
- The `manager_new_booking` template / manager-alert visibility gap — a separate, related bug, explicitly deferred per the design doc.
- Any retry/queueing mechanism for failed sends.
