import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockVerifyAndGet, mockSetAttendance, mockCreate } = vi.hoisted(() => ({
  mockVerifyAndGet: vi.fn(),
  mockSetAttendance: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("../modules/appointments/appointment-link.service", () => ({
  createAppointmentLinkService: () => ({ verifyAndGet: mockVerifyAndGet, setAttendance: mockSetAttendance }),
}));
vi.mock("../modules/appointments/change-request.service", () => ({
  createChangeRequestService: () => ({ create: mockCreate }),
}));
vi.mock("../modules/appointments/appointment-link.repository", () => ({ createAppointmentLinkRepo: () => ({}) }));
vi.mock("../modules/appointments/change-request.deps", () => ({ createChangeRequestDeps: () => ({}) }));
vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({}) }));
vi.mock("../services/notifications", () => ({ sendAttendanceOwnerNotification: vi.fn() }));

import router from "../routes/public-appointment-link";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public/appointments", router);
  return app;
}

describe("public-appointment-link routes", () => {
  beforeEach(() => {
    mockVerifyAndGet.mockReset();
    mockSetAttendance.mockReset();
    mockCreate.mockReset();
  });

  it("POST /:token/verify returns appointment summary on success", async () => {
    mockVerifyAndGet.mockResolvedValue({ id: "apt-1", businessId: "biz-1", businessName: "Studio", serviceName: "Haircut", startTime: "2099-01-01T10:00:00Z", status: "confirmed" });
    const res = await request(buildApp()).post("/api/public/appointments/tok123/verify").send({ phone: "0501234567" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("apt-1");
    expect(mockVerifyAndGet).toHaveBeenCalledWith("tok123", "0501234567");
  });

  it("POST /:token/attendance applies the decision", async () => {
    mockSetAttendance.mockResolvedValue({ status: "confirmed" });
    const res = await request(buildApp())
      .post("/api/public/appointments/tok123/attendance")
      .send({ phone: "0501234567", decision: "confirm" });
    expect(res.status).toBe(200);
    expect(mockSetAttendance).toHaveBeenCalledWith("tok123", "0501234567", "confirm");
  });

  it("POST /:token/change-request creates a request after re-verifying phone", async () => {
    mockVerifyAndGet.mockResolvedValue({ id: "apt-1", businessId: "biz-1", businessName: "Studio", serviceName: "Haircut", startTime: "2099-01-01T10:00:00Z", status: "confirmed" });
    mockCreate.mockResolvedValue({ id: "req-1", status: "pending" });
    const res = await request(buildApp())
      .post("/api/public/appointments/tok123/change-request")
      .send({ phone: "0501234567", type: "cancel", reason: "sick" });
    expect(res.status).toBe(201);
    expect(mockVerifyAndGet).toHaveBeenCalledWith("tok123", "0501234567");
    expect(mockCreate).toHaveBeenCalledWith("apt-1", { type: "cancel", proposedStartTime: undefined, reason: "sick" });
  });

  it("returns 400 when phone is missing", async () => {
    const res = await request(buildApp()).post("/api/public/appointments/tok123/verify").send({});
    expect(res.status).toBe(400);
  });

  it("POST /:token/change-request returns 400 for edit with missing proposedStartTime", async () => {
    mockVerifyAndGet.mockResolvedValue({ id: "apt-1", businessId: "biz-1", businessName: "Studio", serviceName: "Haircut", startTime: "2099-01-01T10:00:00Z", status: "confirmed" });
    const res = await request(buildApp())
      .post("/api/public/appointments/tok123/change-request")
      .send({ phone: "0501234567", type: "edit" });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("POST /:token/change-request returns 400 for edit with malformed proposedStartTime", async () => {
    mockVerifyAndGet.mockResolvedValue({ id: "apt-1", businessId: "biz-1", businessName: "Studio", serviceName: "Haircut", startTime: "2099-01-01T10:00:00Z", status: "confirmed" });
    const res = await request(buildApp())
      .post("/api/public/appointments/tok123/change-request")
      .send({ phone: "0501234567", type: "edit", proposedStartTime: "not-a-date" });
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("POST /:token/change-request creates edit request with a valid proposedStartTime", async () => {
    mockVerifyAndGet.mockResolvedValue({ id: "apt-1", businessId: "biz-1", businessName: "Studio", serviceName: "Haircut", startTime: "2099-01-01T10:00:00Z", status: "confirmed" });
    mockCreate.mockResolvedValue({ id: "req-2", status: "pending" });
    const res = await request(buildApp())
      .post("/api/public/appointments/tok123/change-request")
      .send({ phone: "0501234567", type: "edit", proposedStartTime: "2099-02-01T10:00:00.000Z" });
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith("apt-1", { type: "edit", proposedStartTime: "2099-02-01T10:00:00.000Z", reason: undefined });
  });
});
