import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";
import { extractPhoneNumberId } from "../routes/webhooks";
import { encrypt } from "@torup/shared";

const TEST_KEY = Buffer.alloc(32, 3).toString("base64");

function signedPost(app: express.Express, path: string, body: unknown, appSecret: string) {
  const raw = JSON.stringify(body);
  const signature = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  return request(app)
    .post(path)
    .set("x-hub-signature-256", signature)
    .set("Content-Type", "application/json")
    .send(raw);
}

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
// following properties can be asserted without a real DB:
//   1. Unknown phone_number_id -> 200 + silent drop, no mutation, no send.
//   2. READ-guard isolation: the appointment lookup in handleManagerResponse
//      is scoped by business_id, so a mismatched business_id means the read
//      finds nothing and the handler returns early (before any update runs).
//   3. UPDATE-scoping (defense-in-depth): the two appointments.update(...)
//      calls in handleManagerResponse are themselves issued with BOTH
//      .eq("id", ...) and .eq("business_id", businessId) — verified by
//      recording the exact update-chain calls the mock receives, independent
//      of whether the read guard would also have blocked the request.
//   4. The credential passed to the send adapter is the one resolved from
//      the matched business's whatsapp_credentials row.
// ---------------------------------------------------------------------------

const BUSINESS_A = "biz-a";
const BUSINESS_B = "biz-b";
const PHONE_NUMBER_ID_A = "PN_A";
const ACCESS_TOKEN_A = "token-a";
const APP_SECRET_A = "app-secret-a";
const MANAGER_PHONE_A = "972500000001";
const APPOINTMENT_B = "apt-b-1";

type CredRow = {
  id: string;
  business_id: string;
  phone_number_id: string;
  access_token: string;
  app_secret: string | null;
  verify_token: string | null;
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
// Records every appointments.update(...) call's patch + the field/value pairs
// chained via .eq(...), in call order — lets tests assert the exact scoping
// clauses a given update call site issued, independent of whether the read
// guard earlier in the handler would also have blocked the request.
let appointmentUpdateCalls: { patch: Record<string, unknown>; eqCalls: [string, unknown][] }[];

function freshFixtures() {
  appointmentUpdateCalls = [];
  credentials = [
    {
      id: "cred-a",
      business_id: BUSINESS_A,
      phone_number_id: PHONE_NUMBER_ID_A,
      access_token: encrypt(ACCESS_TOKEN_A),
      app_secret: encrypt(APP_SECRET_A),
      verify_token: encrypt("verify-a"),
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
        const callRecord: { patch: Record<string, unknown>; eqCalls: [string, unknown][] } = {
          patch,
          eqCalls: [],
        };
        appointmentUpdateCalls.push(callRecord);
        const updBuilder: Record<string, unknown> = {
          eq(field: string, value: unknown) {
            updFilters.push({ field, value });
            callRecord.eqCalls.push([field, value]);
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
  const originalKey = process.env.ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    freshFixtures();
    sendWhatsAppMessageMock = vi.fn(async () => "msg-id");
  });
  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
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

  it("acks 200 and drops silently when the payload's phone_number_id doesn't match the path business's number, with no mutation or send", async () => {
    const app = await buildApp();

    // Business A's webhook path, correctly signed with Business A's app
    // secret, but the payload claims a different (unregistered) phone number.
    const res = await signedPost(
      app,
      `/api/webhooks/whatsapp/${BUSINESS_A}`,
      buttonReplyPayload("PN_UNKNOWN", MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`),
      APP_SECRET_A
    );

    expect(res.status).toBe(200);
    // Response is sent before async processing runs; give it a tick to complete.
    await new Promise((r) => setTimeout(r, 20));

    expect(appointments[APPOINTMENT_B].status).toBe("pending_approval");
    expect(sendWhatsAppMessageMock).not.toHaveBeenCalled();
  });

  it("rejects a POST signed with the wrong tenant's app_secret", async () => {
    const app = await buildApp();

    const res = await signedPost(
      app,
      `/api/webhooks/whatsapp/${BUSINESS_A}`,
      buttonReplyPayload(PHONE_NUMBER_ID_A, MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`),
      "wrong-app-secret"
    );

    expect(res.status).toBe(403);
    expect(sendWhatsAppMessageMock).not.toHaveBeenCalled();
  });

  it("READ guard: does not mutate an appointment belonging to a different business than the resolved credential", async () => {
    // NOTE: this proves the appointment READ lookup in handleManagerResponse
    // is scoped by business_id (id matches APPOINTMENT_B, business_id does
    // not match BUSINESS_A) — the mismatch means the read finds nothing and
    // the handler returns early, before either update call runs. It does
    // NOT exercise the update-call scoping itself; see the dedicated
    // "UPDATE scoping" test below for that.
    const app = await buildApp();

    // Manager phone from Business A's WhatsApp number tries to approve an
    // appointment that actually belongs to Business B.
    const res = await signedPost(
      app,
      `/api/webhooks/whatsapp/${BUSINESS_A}`,
      buttonReplyPayload(PHONE_NUMBER_ID_A, MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`),
      APP_SECRET_A
    );

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));

    // The business_id-scoped lookup must find nothing (id matches, business_id doesn't),
    // so the appointment is never touched.
    expect(appointments[APPOINTMENT_B].status).toBe("pending_approval");
    expect(sendWhatsAppMessageMock).not.toHaveBeenCalled();
    expect(appointmentUpdateCalls).toHaveLength(0);
  });

  it("UPDATE scoping: the approve/reject appointments.update() calls include both id and business_id clauses", async () => {
    // Make the READ guard pass (appointment's business_id matches the
    // resolved businessId, manager-identity phone also matches) so execution
    // reaches the update calls Finding 1 actually touched. This test's
    // assertion is entirely about the exact .eq(...) clauses recorded on the
    // update call — independent of whether the read guard would separately
    // have blocked a cross-tenant request.
    appointments[APPOINTMENT_B].business_id = BUSINESS_A;
    appointments[APPOINTMENT_B].businesses.phone = MANAGER_PHONE_A;
    appointments[APPOINTMENT_B].status = "pending_approval";

    const app = await buildApp();

    const res = await signedPost(
      app,
      `/api/webhooks/whatsapp/${BUSINESS_A}`,
      buttonReplyPayload(PHONE_NUMBER_ID_A, MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`),
      APP_SECRET_A
    );

    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));

    expect(appointmentUpdateCalls).toHaveLength(1);
    const [call] = appointmentUpdateCalls;
    expect(call.patch).toEqual({ status: "confirmed" });
    expect(call.eqCalls).toContainEqual(["id", APPOINTMENT_B]);
    expect(call.eqCalls).toContainEqual(["business_id", BUSINESS_A]);
  });

  it("passes the credential resolved from the matched business's whatsapp_credentials row to the send adapter", async () => {
    // Make the appointment belong to Business A and match the manager phone,
    // so the approve path actually goes through to a send.
    appointments[APPOINTMENT_B].business_id = BUSINESS_A;
    appointments[APPOINTMENT_B].businesses.phone = MANAGER_PHONE_A;
    appointments[APPOINTMENT_B].status = "pending_approval";

    const app = await buildApp();

    const res = await signedPost(
      app,
      `/api/webhooks/whatsapp/${BUSINESS_A}`,
      buttonReplyPayload(PHONE_NUMBER_ID_A, MANAGER_PHONE_A, `approve_${APPOINTMENT_B}`),
      APP_SECRET_A
    );

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
