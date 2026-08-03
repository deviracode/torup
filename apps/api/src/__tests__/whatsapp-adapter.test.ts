import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppMessage, type WhatsAppCredential } from "../services/whatsapp";

const cred: WhatsAppCredential = { phoneNumberId: "PN123", accessToken: "TOK456" };

describe("whatsapp adapter credential injection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: "wamid.1" }] }),
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts to the credential's phone_number_id with its token", async () => {
    const id = await sendWhatsAppMessage(cred, "0501234567", "hi");

    expect(id).toBe("wamid.1");
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toContain("/PN123/messages");
    expect((opts.headers as any).Authorization).toBe("Bearer TOK456");
  });

  it("returns null and does not fetch when credential is incomplete", async () => {
    const id = await sendWhatsAppMessage(
      { phoneNumberId: "", accessToken: "" },
      "0501234567",
      "hi",
    );
    expect(id).toBeNull();
    expect(fetch as any).not.toHaveBeenCalled();
  });
});
