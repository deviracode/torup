import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveWabaId, provisionTemplates, TEMPLATE_DEFINITIONS } from "../services/whatsapp-templates";

describe("whatsapp-templates", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("resolveWabaId", () => {
    it("returns the WABA id on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ whatsapp_business_account_id: "waba-1" }),
      }) as any;
      expect(await resolveWabaId("pn1", "tok")).toBe("waba-1");
    });

    it("returns null on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "bad token", type: "OAuthException", code: 190 } }),
      }) as any;
      expect(await resolveWabaId("pn1", "badtok")).toBeNull();
    });
  });

  describe("provisionTemplates", () => {
    it("returns wabaId: null and no results when WABA lookup fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "bad token", type: "OAuthException", code: 190 } }),
      }) as any;
      const result = await provisionTemplates({ phoneNumberId: "pn1", accessToken: "badtok" });
      expect(result).toEqual({ wabaId: null, results: [] });
    });

    it("submits every template definition and reports created status", async () => {
      const fetchMock = vi.fn();
      // First call resolves the WABA id.
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ whatsapp_business_account_id: "waba-1" }),
      });
      // Remaining calls are template submissions — all succeed.
      for (let i = 0; i < TEMPLATE_DEFINITIONS.length; i++) {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      }
      global.fetch = fetchMock as any;

      const { wabaId, results } = await provisionTemplates({ phoneNumberId: "pn1", accessToken: "tok" });
      expect(wabaId).toBe("waba-1");
      expect(results).toHaveLength(TEMPLATE_DEFINITIONS.length);
      expect(results.every((r) => r.status === "created")).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1 + TEMPLATE_DEFINITIONS.length);
    });

    it("treats 'template already exists' as already_exists, not failed", async () => {
      const fetchMock = vi.fn();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ whatsapp_business_account_id: "waba-1" }),
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: "Template already exists", type: "OAuthException", code: 100, error_subcode: 2388023 },
        }),
      });
      global.fetch = fetchMock as any;

      const { results } = await provisionTemplates({ phoneNumberId: "pn1", accessToken: "tok" });
      expect(results.every((r) => r.status === "already_exists")).toBe(true);
    });

    it("reports failed for an unrelated API error without throwing", async () => {
      const fetchMock = vi.fn();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ whatsapp_business_account_id: "waba-1" }),
      });
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "Internal error", type: "OAuthException", code: 1 } }),
      });
      global.fetch = fetchMock as any;

      const { results } = await provisionTemplates({ phoneNumberId: "pn1", accessToken: "tok" });
      expect(results.every((r) => r.status === "failed")).toBe(true);
    });
  });
});
