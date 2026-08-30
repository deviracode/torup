import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveWabaId, provisionTemplates, TEMPLATE_DEFINITIONS } from "../services/whatsapp-templates";

/** Builds a fetch mock that answers the me/businesses -> owned_whatsapp_business_accounts -> phone_numbers walk. */
function graphWalkMock(opts: {
  businesses?: { id: string }[];
  wabasByBusiness?: Record<string, { id: string }[]>;
  phonesByWaba?: Record<string, { id: string }[]>;
}) {
  const businesses = opts.businesses ?? [{ id: "biz-1" }];
  const wabasByBusiness = opts.wabasByBusiness ?? { "biz-1": [{ id: "waba-1" }] };
  const phonesByWaba = opts.phonesByWaba ?? { "waba-1": [{ id: "pn1" }] };

  return vi.fn((url: string) => {
    if (url.includes("me/businesses")) {
      return Promise.resolve({ ok: true, json: async () => ({ data: businesses }) });
    }
    const wabaMatch = businesses.find((b) => url.includes(`${b.id}/owned_whatsapp_business_accounts`));
    if (wabaMatch) {
      return Promise.resolve({ ok: true, json: async () => ({ data: wabasByBusiness[wabaMatch.id] ?? [] }) });
    }
    for (const wabas of Object.values(wabasByBusiness)) {
      const waba = wabas.find((w) => url.includes(`${w.id}/phone_numbers`));
      if (waba) {
        return Promise.resolve({ ok: true, json: async () => ({ data: phonesByWaba[waba.id] ?? [] }) });
      }
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: { message: "not found", type: "x", code: 1 } }) });
  }) as any;
}

describe("whatsapp-templates", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("resolveWabaId", () => {
    it("finds the WABA whose phone_numbers include the given phone_number_id", async () => {
      global.fetch = graphWalkMock({});
      expect(await resolveWabaId("pn1", "tok")).toBe("waba-1");
    });

    it("returns null when the phone number isn't under any owned WABA", async () => {
      global.fetch = graphWalkMock({ phonesByWaba: { "waba-1": [{ id: "some-other-pn" }] } });
      expect(await resolveWabaId("pn1", "tok")).toBeNull();
    });

    it("returns null on API error at the first step", async () => {
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
      const walkMock = graphWalkMock({});
      const fetchMock = vi.fn((url: string, init?: any) => {
        if (init?.method === "POST") return Promise.resolve({ ok: true, json: async () => ({}) });
        return walkMock(url);
      });
      global.fetch = fetchMock as any;

      const { wabaId, results } = await provisionTemplates({ phoneNumberId: "pn1", accessToken: "tok" });
      expect(wabaId).toBe("waba-1");
      expect(results).toHaveLength(TEMPLATE_DEFINITIONS.length);
      expect(results.every((r) => r.status === "created")).toBe(true);
    });

    it("treats 'template already exists' as already_exists, not failed", async () => {
      const walkMock = graphWalkMock({});
      const fetchMock = vi.fn((url: string, init?: any) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: { message: "Template already exists", type: "OAuthException", code: 100, error_subcode: 2388023 },
            }),
          });
        }
        return walkMock(url);
      });
      global.fetch = fetchMock as any;

      const { results } = await provisionTemplates({ phoneNumberId: "pn1", accessToken: "tok" });
      expect(results.every((r) => r.status === "already_exists")).toBe(true);
    });

    it("reports failed for an unrelated API error without throwing", async () => {
      const walkMock = graphWalkMock({});
      const fetchMock = vi.fn((url: string, init?: any) => {
        if (init?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: { message: "Internal error", type: "OAuthException", code: 1 } }),
          });
        }
        return walkMock(url);
      });
      global.fetch = fetchMock as any;

      const { results } = await provisionTemplates({ phoneNumberId: "pn1", accessToken: "tok" });
      expect(results.every((r) => r.status === "failed")).toBe(true);
    });
  });
});
