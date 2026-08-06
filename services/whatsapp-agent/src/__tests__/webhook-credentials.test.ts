import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import request from "supertest";
import { encrypt } from "@torup/shared";

const TEST_KEY = Buffer.alloc(32, 11).toString("base64");

const BUSINESS_A = "biz-a";
const PHONE_NUMBER_ID_A = "PN_A";
const ACCESS_TOKEN_A = "token-a";
const APP_SECRET_A = "app-secret-a";
const VERIFY_TOKEN_A = "verify-a";

let credentialRow: Record<string, unknown> | null;

function makeSupabaseStub() {
  return {
    from: (table: string) => {
      if (table === "whatsapp_credentials") {
        return {
          select: () => ({
            eq: () => ({
              single: async () =>
                credentialRow
                  ? { data: credentialRow, error: null }
                  : { data: null, error: { message: "not found" } },
            }),
          }),
        };
      }
      // businesses / other tables — return "not found" so the flow short-circuits
      // right after credential resolution, which is all this test verifies.
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.single = async () => ({ data: null, error: { message: "not found" } });
      return builder;
    },
  };
}

vi.mock("@torup/db", () => ({
  createClient: () => makeSupabaseStub(),
}));

function signedBody(body: unknown, appSecret: string) {
  const raw = JSON.stringify(body);
  const signature = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  return { raw, signature };
}

describe("whatsapp-agent webhook — per-tenant credential resolution", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalEnvToken = process.env.WHATSAPP_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    // Deliberately unset — proves the send path can't fall back to env even
    // if some code path still referenced it.
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    credentialRow = {
      business_id: BUSINESS_A,
      phone_number_id: PHONE_NUMBER_ID_A,
      access_token: encrypt(ACCESS_TOKEN_A),
      app_secret: encrypt(APP_SECRET_A),
      verify_token: encrypt(VERIFY_TOKEN_A),
      is_active: true,
    };
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
    process.env.WHATSAPP_ACCESS_TOKEN = originalEnvToken;
  });

  async function buildApp() {
    vi.resetModules();
    const mod = await import("../index.js");
    return mod.default;
  }

  it("GET verify challenge succeeds only with the matching tenant's verify_token", async () => {
    const app = await buildApp();

    const ok = await request(app)
      .get(`/webhook/${BUSINESS_A}`)
      .query({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN_A, "hub.challenge": "echo123" });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe("echo123");

    const wrong = await request(app)
      .get(`/webhook/${BUSINESS_A}`)
      .query({ "hub.mode": "subscribe", "hub.verify_token": "not-it", "hub.challenge": "echo123" });
    expect(wrong.status).toBe(403);
  });

  it("GET verify rejects when the business has no credentials", async () => {
    credentialRow = null;
    const app = await buildApp();

    const res = await request(app)
      .get(`/webhook/unknown-biz`)
      .query({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN_A, "hub.challenge": "echo123" });
    expect(res.status).toBe(403);
  });

  it("POST rejects a payload signed with the wrong tenant's app_secret", async () => {
    const app = await buildApp();
    const { raw, signature } = signedBody({ entry: [] }, "wrong-secret");

    const res = await request(app)
      .post(`/webhook/${BUSINESS_A}`)
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(raw);

    expect(res.status).toBe(403);
  });

  it("POST accepts a payload correctly signed with the tenant's own app_secret", async () => {
    const app = await buildApp();
    const { raw, signature } = signedBody({ entry: [] }, APP_SECRET_A);

    const res = await request(app)
      .post(`/webhook/${BUSINESS_A}`)
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(raw);

    expect(res.status).toBe(200);
  });

  it("POST rejects when the business has no credentials row", async () => {
    credentialRow = null;
    const app = await buildApp();
    const { raw, signature } = signedBody({ entry: [] }, APP_SECRET_A);

    const res = await request(app)
      .post(`/webhook/unknown-biz`)
      .set("x-hub-signature-256", signature)
      .set("Content-Type", "application/json")
      .send(raw);

    expect(res.status).toBe(403);
  });
});
