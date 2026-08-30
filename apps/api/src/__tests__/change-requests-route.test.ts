import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = "owner-1"; next(); },
  requireBusinessAccess: (req: any, _res: any, next: any) => { req.businessId = req.params.businessId; next(); },
}));

const { mockListPending, mockApprove, mockReject } = vi.hoisted(() => ({
  mockListPending: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
}));
vi.mock("../modules/appointments/change-request.repository", () => ({
  createChangeRequestRepo: () => ({ listPendingByBusiness: mockListPending }),
}));
vi.mock("../modules/appointments/change-request.service", () => ({
  createChangeRequestService: () => ({ approve: mockApprove, reject: mockReject }),
}));
vi.mock("../modules/appointments/change-request.deps", () => ({ createChangeRequestDeps: () => ({}) }));
vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({}) }));

import router from "../routes/change-requests";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/businesses/:businessId/change-requests", router);
  return app;
}

describe("change-requests dashboard routes", () => {
  it("GET / lists pending requests for the business", async () => {
    mockListPending.mockResolvedValue({ data: [{ id: "req-1", status: "pending" }], error: null });
    const res = await request(buildApp()).get("/api/businesses/biz-1/change-requests");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockListPending).toHaveBeenCalledWith("biz-1");
  });

  it("POST /:id/approve calls the service with the authenticated user id", async () => {
    mockApprove.mockResolvedValue({ status: "approved" });
    const res = await request(buildApp()).post("/api/businesses/biz-1/change-requests/req-1/approve");
    expect(res.status).toBe(200);
    expect(mockApprove).toHaveBeenCalledWith("biz-1", "req-1", "owner-1");
  });

  it("POST /:id/reject calls the service with the authenticated user id", async () => {
    mockReject.mockResolvedValue({ status: "rejected" });
    const res = await request(buildApp()).post("/api/businesses/biz-1/change-requests/req-1/reject");
    expect(res.status).toBe(200);
    expect(mockReject).toHaveBeenCalledWith("biz-1", "req-1", "owner-1");
  });
});
