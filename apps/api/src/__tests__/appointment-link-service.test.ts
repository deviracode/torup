import { describe, it, expect, vi } from "vitest";
import { createAppointmentLinkService } from "../modules/appointments/appointment-link.service";
import { AppError } from "../middleware/error-handler";

function makeRepo(row: any, overrides: any = {}) {
  return {
    getByToken: vi.fn().mockResolvedValue({ data: row, error: row ? null : { message: "not found" } }),
    updateAttendance: vi.fn().mockResolvedValue({ data: { id: row?.id, status: "confirmed" }, error: null }),
    ...overrides,
  };
}

const ROW = {
  id: "apt-1",
  status: "confirmed",
  start_time: "2099-01-01T10:00:00Z",
  end_time: "2099-01-01T11:00:00Z",
  business_id: "biz-1",
  service_id: "svc-1",
  customers: { id: "cust-1", name: "Dana", phone: "972501234567", language_preference: "he" },
  services: { name_he: "תספורת", name_ar: null, name_en: null },
  businesses: { name: "Studio" },
};

describe("appointment-link service", () => {
  it("verifyAndGet succeeds when phone matches (normalized local format)", async () => {
    const repo = makeRepo(ROW);
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: vi.fn(), getCancellationWindowMinutes: vi.fn().mockResolvedValue(120) });
    const result = await svc.verifyAndGet("tok123", "0501234567");
    expect(result.id).toBe("apt-1");
    expect(result.serviceId).toBe("svc-1");
    expect((result as any).customerPhone).toBeUndefined(); // never leak the raw phone back
  });

  // Anti-enumeration: "wrong phone" and "bad token" must be genuinely
  // indistinguishable to a caller probing the API directly (same status
  // code AND same message), so neither the HTTP status nor the response
  // body can be used to confirm a token exists. The 410 "inactive
  // appointment" case is NOT merged with these: reaching it requires the
  // phone to have already matched, so the caller has already proven they're
  // the legitimate customer and no enumeration risk remains.
  it("verifyAndGet throws generic 404 when phone does not match (indistinguishable from bad token)", async () => {
    const repo = makeRepo(ROW);
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: vi.fn(), getCancellationWindowMinutes: vi.fn().mockResolvedValue(120) });
    await expect(svc.verifyAndGet("tok123", "0509999999")).rejects.toMatchObject({
      statusCode: 404,
      message: "Appointment link not found or phone number does not match",
    });
  });

  it("verifyAndGet throws generic 404 when token does not exist (indistinguishable from wrong phone)", async () => {
    const repo = makeRepo(null);
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: vi.fn(), getCancellationWindowMinutes: vi.fn().mockResolvedValue(120) });
    await expect(svc.verifyAndGet("bad-token", "0501234567")).rejects.toMatchObject({
      statusCode: 404,
      message: "Appointment link not found or phone number does not match",
    });
  });

  it("verifyAndGet throws 410 (gone) when appointment is cancelled/completed/no_show", async () => {
    const repo = makeRepo({ ...ROW, status: "cancelled" });
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: vi.fn(), getCancellationWindowMinutes: vi.fn().mockResolvedValue(120) });
    await expect(svc.verifyAndGet("tok123", "0501234567")).rejects.toMatchObject({ statusCode: 410 });
  });

  it("verifyAndGet matches international-format and formatted phone input against a stored number", async () => {
    const repo = makeRepo(ROW); // ROW.customers.phone is "972501234567"
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: vi.fn(), getCancellationWindowMinutes: vi.fn().mockResolvedValue(120) });
    await expect(svc.verifyAndGet("tok123", "+972-50-123-4567")).resolves.toMatchObject({ id: "apt-1" });
    await expect(svc.verifyAndGet("tok123", "972501234567")).resolves.toMatchObject({ id: "apt-1" });
  });

  it("setAttendance confirm updates status=confirmed, customer_confirmed=true, notifies owner", async () => {
    const repo = makeRepo(ROW);
    const notifyOwner = vi.fn().mockResolvedValue(undefined);
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: notifyOwner, getCancellationWindowMinutes: vi.fn().mockResolvedValue(120) });
    await svc.setAttendance("tok123", "0501234567", "confirm");
    expect(repo.updateAttendance).toHaveBeenCalledWith("apt-1", "confirmed", true);
    expect(notifyOwner).toHaveBeenCalledWith("apt-1", "confirm");
  });

  it("setAttendance reject updates status=cancelled, customer_confirmed=false", async () => {
    const repo = makeRepo(ROW);
    const svc = createAppointmentLinkService(repo as any, { notifyOwnerOfAttendance: vi.fn().mockResolvedValue(undefined), getCancellationWindowMinutes: vi.fn().mockResolvedValue(120) });
    await svc.setAttendance("tok123", "0501234567", "reject");
    expect(repo.updateAttendance).toHaveBeenCalledWith("apt-1", "cancelled", false);
  });

  it("setAttendance reject throws 400 and does not cancel when inside the business's cancellation window", async () => {
    const soonRow = { ...ROW, start_time: new Date(Date.now() + 32 * 60_000).toISOString() };
    const repo = makeRepo(soonRow);
    const svc = createAppointmentLinkService(repo as any, {
      notifyOwnerOfAttendance: vi.fn(),
      getCancellationWindowMinutes: vi.fn().mockResolvedValue(120),
    });
    await expect(svc.setAttendance("tok123", "0501234567", "reject")).rejects.toMatchObject({
      statusCode: 400,
      message: "Too close to the appointment time to cancel",
    });
    expect(repo.updateAttendance).not.toHaveBeenCalled();
  });

  it("setAttendance confirm is not gated by the cancellation window, even right before the appointment", async () => {
    const soonRow = { ...ROW, start_time: new Date(Date.now() + 5 * 60_000).toISOString() };
    const repo = makeRepo(soonRow);
    const svc = createAppointmentLinkService(repo as any, {
      notifyOwnerOfAttendance: vi.fn().mockResolvedValue(undefined),
      getCancellationWindowMinutes: vi.fn().mockResolvedValue(120),
    });
    await svc.setAttendance("tok123", "0501234567", "confirm");
    expect(repo.updateAttendance).toHaveBeenCalledWith("apt-1", "confirmed", true);
  });
});
