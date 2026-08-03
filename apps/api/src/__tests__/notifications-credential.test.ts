import { describe, it, expect, vi } from "vitest";
import { resolveBusinessCredential } from "../services/notifications";

describe("resolveBusinessCredential", () => {
  it("returns null and logs when the business has no credential", async () => {
    const warn = vi.spyOn(console, "log").mockImplementation(() => {});
    const fakeService = { resolveForBusiness: vi.fn().mockResolvedValue(null) };
    const cred = await resolveBusinessCredential("biz-1", fakeService as any);
    expect(cred).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("biz-1"));
    warn.mockRestore();
  });

  it("returns the credential when present", async () => {
    const fakeService = { resolveForBusiness: vi.fn().mockResolvedValue({ phoneNumberId: "pn", accessToken: "tok" }) };
    const cred = await resolveBusinessCredential("biz-1", fakeService as any);
    expect(cred).toEqual({ phoneNumberId: "pn", accessToken: "tok" });
  });
});
