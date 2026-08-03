import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { extractPhoneNumberId } from "../routes/webhooks";

describe("extractPhoneNumberId", () => {
  it("reads metadata.phone_number_id from a WhatsApp payload", () => {
    const body = {
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "PN999" }, messages: [] } }] }],
    };
    expect(extractPhoneNumberId(body)).toBe("PN999");
  });

  it("returns null when absent", () => {
    expect(extractPhoneNumberId({})).toBeNull();
    expect(extractPhoneNumberId({ entry: [{ changes: [{ value: {} }] }] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tenant-isolation tests for the POST /whatsapp inbound handler.
//
// These mock the Supabase service client with a tiny in-memory table store
// (same pattern as approval.test.ts) plus the WhatsApp send adapter, so the
// three security-critical properties can be asserted without a real DB:
//   1. Unknown phone_number_id -> 200 + silent drop, no mutation, no send.
//   2. Cross-tenant: a manager reply resolved from Business A's number can't
//      touch an appointment that actually belongs to Business B.
//   3. The credential passed to the send adapter is the one resolved from
//      the matched business's whatsapp_credentials row.
// ---------------------------------------------------------------------------

const BUSINESS_A = "biz-a";
const BUSINESS_B = "biz-b";
const PHONE_NUMBER_ID_A = "PN_A";
const ACCESS_TOKEN_A = "token-a";
const MANAGER_PHONE_A = "972500000001";
const APPOINTMENT_B = "apt-b-1";

type CredRow = {
  id: string;
  business_id: string;
  phone_number_id: string;
  access_token: string;
  display_phone: string | null;
  verified_at: string | null;
  is_active: boolean;
};

type AptRow = {
  id: string;
  business_id: string;
  status: string;
  businesses: { phone: string };
};

let credentials: CredRow[];
let appointments: Record<string, AptRow>;

function freshFixtures() {
  credentials = [
    {
      id: "cred-a",
      business_id: BUSINESS_A,
      phone_number_id: PHONE_NUMBER_ID_A,
      access_token: ACCESS_TOKEN_A,
      display_phone: null,
      verified_at: null,
      is_active: true,
    },
  ];
  appointments = {
    [APPOINTMENT_B]: {
      id: APPOINTMENT_B,
      business_id: BUSINESS_B,
      status: "pending_approval",
      // Same owner phone as Business A's manager number on purpose: this
      // isolates the business_id scoping as the ONLY thing preventing
      // cross-tenant action here. If the phone numbers differed, the
      // manager-identity check would also reject it and the test would
      // pass even without correct business_id scoping (false confidence).
      businesses: { phone: MANAGER_PHONE_A },
    },
  };
}

// Minimal chainable Supabase stub covering whatsapp_credentials + appointments.
// Other tables used by handleButtonResponse (notifications_log, customers)
// are stubbed to always return "not found" since these tests only exercise
// the manager (approve/reject) path.
function makeSupabaseStub() {
  function tableStub(table: string) {
    if (table === "whatsapp_credentials") {
      const filters: { field: string; value: unknown }[] = [];
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (field: string, value: unknown) => {
        filters.push({ field, value });
        return builder;
      };
      builder.single = async () => {
        const row = credentials.find((c) =>
          filters.every((f) => (c as Record<string, unknown>)[f.field] === f.value)
        );
        return { data: row ?? null, error: row ? null : { message: "not found" } };
      };
      return builder;
    }

    if (table === "appointments") {
      const filters: { field: string; value: unknown }[] = [];
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (field: string, value: unknown) => {
        filters.push({ field, value });
        return builder;
      };
      builder.single = async () => {
        const row = Object.values(appointments).find((a) =>
          filters.every((f) => (a as Record<string, unknown>)[f.field] === f.value)
        );
        return { data: row ?? null, error: row ? null : { message: "not found" } };
      };
      builder.update = (patch: Record<string, unknown>) => {
        const updFilters: { field: string; value: unknown }[] = [];
        const updBuilder: Record<string, unknown> = {
          eq(field: string, value: unknown) {
            updFilters.push({ field, value });
            return updBuilder;
          },
          then(resolve: (v: { error: null }) => void) {
            for (const a of Object.values(appointments)) {
              const matches = updFilters.every(
                (f) => (a as Record<string, unknown>)[f.field] === f.value
              );
              if (matches) Object.assign(a, patch);
            }
            resolve({ error: null });
            return Promise.resolve({ error: null });
          },
        };
        return updBuilder;
      };
      return builder;
    }

    // notifications_log / customers — not exercised by the manager-response
    // tests below; return empty results so handleButtonResponse short-circuits.
    const emptyBuilder: Record<string, unknown> = {};
    emptyBuilder.select = () => emptyBuilder;
    emptyBuilder.eq = () => emptyBuilder;
    emptyBuilder.like = () => emptyBuilder;
    emptyBuilder.not = () => emptyBuilder;
    emptyBuilder.order = () => emptyBuilder;
    emptyBuilder.limit = () => Promise.resolve({ data: [], error: null });
    emptyBuilder.single = async () => ({ data: null, error: { message: "not found" } });
    return emptyBuilder;
  }

  return { from: tableStub };
}

let sendWhatsAppMessageMock: ReturnType<typeof vi.fn>;

vi.mock("../lib/supabase", () => ({
  createServiceClient: () => makeSupabaseStub(),
}));

vi.mock("../services/whatsapp", async () => {
  const actual = await vi.importActual<typeof import("../services/whatsapp")>("../services/whatsapp");
  return {
    ...actual,
    sendWhatsAppMessage: (...args: unknown[]) => sendWhatsAppMessageMock(...args),
  };
});

vi.mock("../services/notifications", () => ({
  sendApprovalNotification: vi.fn(async () => undefined),
  sendRejectionNotification: vi.fn(async () => undefined),
}));

describe("POST /whatsapp inbound routing — tenant isolation", () => {
  beforeEach(() => {
    freshFixtures();
    sendWhatsAppMessageMock = vi.fn(async () => "msg-id");
  });

  async function buildApp() {
    const router = (await import("../routes/webhooks")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/webhooks", router);
    return app;
  }

  function buttonReplyPayload(phoneNumberId: string, from: string, buttonId: string) {
    return {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: phoneNumberId },
                messages: [
                  {
                    type: "interactive",
                    from,
                    interactive: { button_reply: { id: buttonId } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  it("acks 200 and drops silently for an unknown phone_number_id, with no mutation or send", async () => {
    const app = await buildApp();

    const res = await request(app)
      .post("/api/webhooks/whatsapp")
      .send(buttonReplyPayload("PN_UNKNOWN", MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`));

    expect(res.status).toBe(200);
    // Response is sent before async processing runs; give it a tick to complete.
    await new Promise((r) => setTimeout(r, 20));

    expect(appointments[APPOINTMENT_B].status).toBe("pending_approval");
    expect(sendWhatsAppMessageMock).not.toHaveBeenCalled();
  });

  it("does not mutate an appointment belonging to a different business than the resolved credential", async () => {
    const app = await buildApp();

    // Manager phone from Business A's WhatsApp number tries to approve an
    // appointment that actually belongs to Business B.
    const res = await request(app)
      .post("/api/webhooks/whatsapp")
      .send(buttonReplyPayload(PHONE_NUMBER_ID_A, MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`));

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));

    // The business_id-scoped lookup must find nothing (id matches, business_id doesn't),
    // so the appointment is never touched.
    expect(appointments[APPOINTMENT_B].status).toBe("pending_approval");
    expect(sendWhatsAppMessageMock).not.toHaveBeenCalled();
  });

  it("passes the credential resolved from the matched business's whatsapp_credentials row to the send adapter", async () => {
    // Make the appointment belong to Business A and match the manager phone,
    // so the approve path actually goes through to a send.
    appointments[APPOINTMENT_B].business_id = BUSINESS_A;
    appointments[APPOINTMENT_B].businesses.phone = MANAGER_PHONE_A;
    appointments[APPOINTMENT_B].status = "pending_approval";

    const app = await buildApp();

    const res = await request(app)
      .post("/api/webhooks/whatsapp")
      .send(buttonReplyPayload(PHONE_NUMBER_ID_A, MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`));

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));

    expect(appointments[APPOINTMENT_B].status).toBe("confirmed");
    expect(sendWhatsAppMessageMock).toHaveBeenCalledWith(
      { phoneNumberId: PHONE_NUMBER_ID_A, accessToken: ACCESS_TOKEN_A },
      MANAGER_PHONE_A,
      expect.any(String)
    );
  });
});
