import { describe, it, expect, vi } from "vitest";
import { createChangeRequestService } from "../modules/appointments/change-request.service";
import { AppError } from "../middleware/error-handler";

function makeDeps(overrides: any = {}) {
  return {
    changeRequestRepo: {
      findPendingByAppointment: vi.fn().mockResolvedValue({ data: null, error: null }),
      create: vi.fn().mockResolvedValue({ data: { id: "req-1", status: "pending", type: "cancel" }, error: null }),
      findByIdAndBusiness: vi.fn(),
      updateStatus: vi.fn().mockResolvedValue({ data: { id: "req-1", status: "approved" }, error: null }),
      listPendingByBusiness: vi.fn(),
    },
    getBookingRules: vi.fn().mockResolvedValue({ cancellation_window_minutes: 120, reschedule_window_minutes: 120 }),
    getAppointment: vi.fn().mockResolvedValue({
      id: "apt-1", business_id: "biz-1", service_id: "svc-1", status: "confirmed",
      start_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3h from now
    }),
    checkCapacity: vi.fn().mockResolvedValue(true),
    updateAppointmentTime: vi.fn().mockResolvedValue(undefined),
    cancelAppointment: vi.fn().mockResolvedValue(undefined),
    notifyOwnerOfNewRequest: vi.fn().mockResolvedValue(undefined),
    notifyCustomerOfResolution: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("change-request service", () => {
  it("create() rejects a cancel request inside the cancellation window", async () => {
    const deps = makeDeps({
      getBookingRules: vi.fn().mockResolvedValue({ cancellation_window_minutes: 240, reschedule_window_minutes: 120 }),
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.create("apt-1", { type: "cancel" })).rejects.toThrow(AppError);
  });

  it("create() rejects when a pending request already exists", async () => {
    const deps = makeDeps({
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findPendingByAppointment: vi.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.create("apt-1", { type: "cancel" })).rejects.toThrow(AppError);
  });

  it("create() succeeds within the window and notifies the owner", async () => {
    const deps = makeDeps();
    const svc = createChangeRequestService(deps as any);
    const result = await svc.create("apt-1", { type: "cancel", reason: "sick" });
    expect(deps.changeRequestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ appointment_id: "apt-1", business_id: "biz-1", type: "cancel", reason: "sick" })
    );
    expect(deps.notifyOwnerOfNewRequest).toHaveBeenCalledWith("req-1");
    expect(result.id).toBe("req-1");
  });

  it("approve() on an edit request re-checks capacity and fails if the slot is taken", async () => {
    const deps = makeDeps({
      checkCapacity: vi.fn().mockResolvedValue(false),
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "edit", status: "pending", proposed_start_time: "2099-01-01T10:00:00Z" },
          error: null,
        }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.approve("biz-1", "req-1", "owner-1")).rejects.toThrow(AppError);
    expect(deps.updateAppointmentTime).not.toHaveBeenCalled();
  });

  it("approve() on an edit request updates the appointment time and notifies the customer", async () => {
    const deps = makeDeps({
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "edit", status: "pending", proposed_start_time: "2099-01-01T10:00:00Z" },
          error: null,
        }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await svc.approve("biz-1", "req-1", "owner-1");
    expect(deps.updateAppointmentTime).toHaveBeenCalledWith("apt-1", "2099-01-01T10:00:00Z");
    expect(deps.changeRequestRepo.updateStatus).toHaveBeenCalledWith("req-1", "approved", "owner-1");
    expect(deps.notifyCustomerOfResolution).toHaveBeenCalledWith("req-1", "approved");
  });

  it("approve() on a cancel request re-validates the appointment isn't already resolved", async () => {
    const deps = makeDeps({
      getAppointment: vi.fn().mockResolvedValue({ id: "apt-1", business_id: "biz-1", status: "cancelled", start_time: "2099-01-01T10:00:00Z" }),
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "cancel", status: "pending", proposed_start_time: null },
          error: null,
        }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await expect(svc.approve("biz-1", "req-1", "owner-1")).rejects.toThrow(AppError);
    expect(deps.cancelAppointment).not.toHaveBeenCalled();
  });

  it("reject() marks the request rejected and notifies the customer, without touching the appointment", async () => {
    const deps = makeDeps({
      changeRequestRepo: {
        ...makeDeps().changeRequestRepo,
        findByIdAndBusiness: vi.fn().mockResolvedValue({
          data: { id: "req-1", appointment_id: "apt-1", business_id: "biz-1", type: "cancel", status: "pending", proposed_start_time: null },
          error: null,
        }),
        updateStatus: vi.fn().mockResolvedValue({ data: { id: "req-1", status: "rejected" }, error: null }),
      },
    });
    const svc = createChangeRequestService(deps as any);
    await svc.reject("biz-1", "req-1", "owner-1");
    expect(deps.changeRequestRepo.updateStatus).toHaveBeenCalledWith("req-1", "rejected", "owner-1");
    expect(deps.cancelAppointment).not.toHaveBeenCalled();
    expect(deps.updateAppointmentTime).not.toHaveBeenCalled();
    expect(deps.notifyCustomerOfResolution).toHaveBeenCalledWith("req-1", "rejected");
  });
});
