import { describe, it, expect, vi } from "vitest";
import { createWhatsAppCredentialsService } from "../modules/whatsapp/whatsapp-credentials.service";

function repoWith(row: any) {
  return {
    getByBusinessId: vi.fn().mockResolvedValue({ data: row, error: null }),
    upsert: vi.fn().mockResolvedValue({ data: row, error: null }),
    markVerified: vi.fn().mockResolvedValue({ error: null }),
  } as any;
}

describe("whatsapp-credentials service", () => {
  it("resolveForBusiness returns the credential shape", async () => {
    const svc = createWhatsAppCredentialsService(
      repoWith({ phone_number_id: "pn1", access_token: "tok", is_active: true }),
    );
    expect(await svc.resolveForBusiness("b1")).toEqual({ phoneNumberId: "pn1", accessToken: "tok" });
  });

  it("resolveForBusiness returns null when no row", async () => {
    const svc = createWhatsAppCredentialsService(repoWith(null));
    expect(await svc.resolveForBusiness("b1")).toBeNull();
  });

  it("status never leaks the token", async () => {
    const svc = createWhatsAppCredentialsService(
      repoWith({ phone_number_id: "pn1", access_token: "tok", display_phone: "+972", verified_at: null, is_active: true }),
    );
    const out = await svc.status("b1");
    expect(out).toEqual({ connected: true, displayPhone: "+972", verifiedAt: null });
    expect(JSON.stringify(out)).not.toContain("tok");
  });

  it("testSend marks verified on success", async () => {
    const repo = repoWith({ phone_number_id: "pn1", access_token: "tok", is_active: true });
    const sendMessage = vi.fn().mockResolvedValue("wamid.1");
    const svc = createWhatsAppCredentialsService(repo, { sendMessage });
    const res = await svc.testSend("b1", "0501234567");
    expect(res).toEqual({ ok: true });
    expect(sendMessage).toHaveBeenCalledWith(
      { phoneNumberId: "pn1", accessToken: "tok" },
      "0501234567",
      expect.any(String),
    );
    expect(repo.markVerified).toHaveBeenCalledWith("b1");
  });

  it("testSend throws when no credential", async () => {
    const svc = createWhatsAppCredentialsService(repoWith(null), { sendMessage: vi.fn() });
    await expect(svc.testSend("b1", "05")).rejects.toThrow();
  });
});
