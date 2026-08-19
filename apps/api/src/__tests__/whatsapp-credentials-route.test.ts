import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireBusinessAccess: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

const statusMock = vi.fn().mockResolvedValue({ connected: false, displayPhone: null, verifiedAt: null });
const saveMock = vi.fn().mockResolvedValue({ connected: true, displayPhone: "+972", verifiedAt: null });

vi.mock("../modules/whatsapp/whatsapp-credentials.service", () => ({
  createWhatsAppCredentialsService: () => ({ status: statusMock, save: saveMock, testSend: vi.fn() }),
}));
vi.mock("../modules/whatsapp/whatsapp-credentials.repository", () => ({
  createWhatsAppCredentialsRepo: () => ({}),
}));
vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({}) }));

let router: any;
beforeEach(async () => {
  router = (await import("../routes/whatsapp-credentials")).default;
});

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/businesses/:businessId/whatsapp", router);
  return a;
}

describe("whatsapp-credentials route", () => {
  it("GET returns masked status", async () => {
    const res = await request(app()).get("/api/businesses/b1/whatsapp");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false, displayPhone: null, verifiedAt: null });
  });

  it("PUT rejects missing fields", async () => {
    const res = await request(app()).put("/api/businesses/b1/whatsapp").send({ phoneNumberId: "pn" });
    expect(res.status).toBe(400);
  });

  it("PUT saves and returns masked view (never the token)", async () => {
    const res = await request(app())
      .put("/api/businesses/b1/whatsapp")
      .send({ phoneNumberId: "pn", accessToken: "tok", appSecret: "sec", verifyToken: "vtok", displayPhone: "+972" });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("tok");
    expect(JSON.stringify(res.body)).not.toContain("sec");
    expect(saveMock).toHaveBeenCalledWith("b1", {
      phoneNumberId: "pn",
      accessToken: "tok",
      appSecret: "sec",
      verifyToken: "vtok",
      displayPhone: "+972",
    });
  });
});
