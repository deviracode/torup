import { describe, it, expect, vi } from "vitest";
import { createWhatsAppCredentialsRepo } from "../modules/whatsapp/whatsapp-credentials.repository";

function fakeClient(handlers: Record<string, any>) {
  return {
    from: vi.fn((table: string) => handlers[table]),
  } as any;
}

describe("whatsapp-credentials repository", () => {
  it("getByPhoneNumberId queries by phone_number_id and returns the row", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "c1", business_id: "b1", phone_number_id: "pn1" }, error: null });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { select } }));

    const res = await repo.getByPhoneNumberId("pn1");

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("phone_number_id", "pn1");
    expect(res.data).toEqual({ id: "c1", business_id: "b1", phone_number_id: "pn1" });
  });

  it("upsert writes business_id + credential fields with onConflict business_id", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "c1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const repo = createWhatsAppCredentialsRepo(fakeClient({ whatsapp_credentials: { upsert } }));

    await repo.upsert("b1", { phoneNumberId: "pn1", accessToken: "tok", displayPhone: "+972..." });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: "b1",
        phone_number_id: "pn1",
        access_token: "tok",
        display_phone: "+972...",
      }),
      { onConflict: "business_id" },
    );
  });
});
