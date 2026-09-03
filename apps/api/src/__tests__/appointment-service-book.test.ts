import { describe, it, expect, vi } from "vitest";
import { createAppointmentService, type AppointmentDeps } from "../modules/appointments/appointment.service";
import { AppError } from "../middleware/error-handler";

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    findServiceById: vi.fn().mockResolvedValue({
      data: { duration_minutes: 30, buffer_minutes: 0, max_capacity: 1 },
      error: null,
    }),
    bookAtomic: vi.fn().mockResolvedValue({
      data: { id: "apt-1", business_id: "biz-1", status: "pending_approval" },
      error: null,
    }),
    ...overrides,
  };
}

function makeDeps(): AppointmentDeps {
  return {
    cache: { get: vi.fn(), set: vi.fn(), clear: vi.fn() },
    notify: {
      sendAppointment: vi.fn().mockResolvedValue(undefined),
      sendManager: vi.fn().mockResolvedValue(undefined),
      sendApproval: vi.fn().mockResolvedValue(undefined),
      sendRejection: vi.fn().mockResolvedValue(undefined),
    },
    gcal: { pushAppointment: vi.fn().mockResolvedValue(undefined) },
  };
}

const INPUT = {
  service_id: "svc-1",
  customer_id: "cust-1",
  start_time: "2099-01-01T10:00:00.000Z",
};

describe("appointment.service book()", () => {
  it("books via the atomic capacity-check-and-insert repo call, not a separate check-then-create", async () => {
    const repo = makeRepo();
    const svc = createAppointmentService(repo as any, makeDeps());
    const result = await svc.book("biz-1", INPUT);
    expect(repo.bookAtomic).toHaveBeenCalledTimes(1);
    expect(repo.bookAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ business_id: "biz-1", service_id: "svc-1", customer_id: "cust-1" })
    );
    expect(result).toMatchObject({ id: "apt-1" });
  });

  it("throws 409 when book_appointment_atomic reports the slot is full (Postgres error code P0001)", async () => {
    const repo = makeRepo({
      bookAtomic: vi.fn().mockResolvedValue({ data: null, error: { code: "P0001", message: "SLOT_FULL" } }),
    });
    const svc = createAppointmentService(repo as any, makeDeps());
    await expect(svc.book("biz-1", INPUT)).rejects.toMatchObject({
      statusCode: 409,
      message: "Time slot is fully booked",
    });
  });

  it("passes idempotency_key through to the atomic repo call so a retry with the same key returns the original booking, not a duplicate", async () => {
    const repo = makeRepo();
    const svc = createAppointmentService(repo as any, makeDeps());
    await svc.book("biz-1", { ...INPUT, idempotency_key: "retry-key-123" });
    expect(repo.bookAtomic).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: "retry-key-123" })
    );
  });

  it("throws 404 when the service doesn't exist, without attempting to book", async () => {
    const repo = makeRepo({ findServiceById: vi.fn().mockResolvedValue({ data: null, error: null }) });
    const svc = createAppointmentService(repo as any, makeDeps());
    await expect(svc.book("biz-1", INPUT)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.bookAtomic).not.toHaveBeenCalled();
  });

  it("non-manual booking notifies the customer (pending) and the manager, not approval", async () => {
    const repo = makeRepo();
    const deps = makeDeps();
    const svc = createAppointmentService(repo as any, deps);
    await svc.book("biz-1", INPUT);
    expect(deps.notify.sendAppointment).toHaveBeenCalledWith("apt-1", "booking_pending_approval");
    expect(deps.notify.sendManager).toHaveBeenCalledWith("apt-1");
    expect(deps.notify.sendApproval).not.toHaveBeenCalled();
  });

  it("manual booking confirmed directly notifies via the approval template path, not pending/manager", async () => {
    const repo = makeRepo({
      bookAtomic: vi.fn().mockResolvedValue({
        data: { id: "apt-2", business_id: "biz-1", status: "confirmed" },
        error: null,
      }),
    });
    const deps = makeDeps();
    const svc = createAppointmentService(repo as any, deps);
    await svc.book("biz-1", { ...INPUT, created_via: "manual", status: "confirmed" });
    expect(deps.notify.sendApproval).toHaveBeenCalledWith("apt-2");
    expect(deps.notify.sendAppointment).not.toHaveBeenCalled();
    expect(deps.notify.sendManager).not.toHaveBeenCalled();
  });
});
