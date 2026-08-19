import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWhatsAppCredentialsRepo } from "../modules/whatsapp/whatsapp-credentials.repository";
import { encrypt, decrypt } from "@torup/shared";

const TEST_KEY = Buffer.alloc(32, 9).toString("base64");

function fakeClient(handlers: Record<string, any>) {
  return {
    from: vi.fn((table: string) => handlers[table]),
  } as any;
}

describe("whatsapp-credentials repository", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it("getByPhoneNumberId queries by phone_number_id and decrypts the row", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "c1", business_id: "b1", phone_number_id: "pn1", access_token: encrypt("tok"), app_secret: null, verify_token: null },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { select } }));

    const res = await repo.getByPhoneNumberId("pn1");

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("phone_number_id", "pn1");
    expect(res.data).toEqual({ id: "c1", business_id: "b1", phone_number_id: "pn1", access_token: "tok", app_secret: null, verify_token: null });
  });

  it("getByBusinessId queries by business_id and decrypts the row", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "c1", business_id: "b1", phone_number_id: "pn1", access_token: encrypt("tok"), app_secret: encrypt("secret"), verify_token: encrypt("verify") },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { select } }));

    const res = await repo.getByBusinessId("b1");

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("business_id", "b1");
    expect(res.data).toEqual({ id: "c1", business_id: "b1", phone_number_id: "pn1", access_token: "tok", app_secret: "secret", verify_token: "verify" });
  });

  it("getByBusinessId tolerates legacy plaintext access_token rows", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "c1", business_id: "b1", phone_number_id: "pn1", access_token: "legacy-plaintext-tok", app_secret: null, verify_token: null },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { select } }));

    const res = await repo.getByBusinessId("b1");

    expect(res.data?.access_token).toBe("legacy-plaintext-tok");
  });

  it("upsert encrypts access_token/app_secret/verify_token before writing, with onConflict business_id", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "c1", access_token: encrypt("tok"), app_secret: encrypt("appsec"), verify_token: encrypt("vtok") }, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { upsert } }));

    await repo.upsert("b1", { phoneNumberId: "pn1", accessToken: "tok", appSecret: "appsec", verifyToken: "vtok", displayPhone: "+972..." });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: "b1",
        phone_number_id: "pn1",
        display_phone: "+972...",
      }),
      { onConflict: "business_id" },
    );
    const writtenRow = upsert.mock.calls[0][0];
    expect(writtenRow.access_token).not.toBe("tok");
    expect(decrypt(writtenRow.access_token)).toBe("tok");
    expect(decrypt(writtenRow.app_secret)).toBe("appsec");
    expect(decrypt(writtenRow.verify_token)).toBe("vtok");
  });

  it("upsert writes null app_secret/verify_token when not provided", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "c1", access_token: encrypt("tok"), app_secret: null, verify_token: null }, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { upsert } }));

    await repo.upsert("b1", { phoneNumberId: "pn1", accessToken: "tok" });

    const writtenRow = upsert.mock.calls[0][0];
    expect(writtenRow.app_secret).toBeNull();
    expect(writtenRow.verify_token).toBeNull();
  });

  it("markVerified updates verified_at timestamp for business_id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { update } }));

    const res = await repo.markVerified("b1");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ verified_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith("business_id", "b1");
    expect(res.error).toBe(null);
  });
});
