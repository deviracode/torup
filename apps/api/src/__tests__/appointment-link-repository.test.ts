import { describe, it, expect, vi } from "vitest";
import { createAppointmentLinkRepo } from "../modules/appointments/appointment-link.repository";

function fakeClient(handlers: Record<string, any>) {
  return { from: vi.fn((table: string) => handlers[table]) } as any;
}

describe("appointment-link repository", () => {
  it("getByToken selects by customer_link_token and returns the joined row", async () => {
    const row = {
      id: "apt-1",
      status: "confirmed",
      start_time: "2026-09-01T10:00:00Z",
      end_time: "2026-09-01T11:00:00Z",
      business_id: "biz-1",
      service_id: "svc-1",
      customers: { id: "cust-1", name: "Dana", phone: "972501234567", language_preference: "he" },
      services: { name_he: "תספורת", name_ar: null, name_en: null },
      businesses: { name: "Studio" },
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const repo = createAppointmentLinkRepo(fakeClient({ appointments: { select } }));

    const { data } = await repo.getByToken("tok123");

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("customer_link_token", "tok123");
    expect(data).toEqual(row);
  });

  it("updateAttendance sets status and customer_confirmed", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "apt-1", status: "confirmed" }, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const repo = createAppointmentLinkRepo(fakeClient({ appointments: { update } }));

    await repo.updateAttendance("apt-1", "confirmed", true);

    expect(update).toHaveBeenCalledWith({ status: "confirmed", customer_confirmed: true });
    expect(eq).toHaveBeenCalledWith("id", "apt-1");
  });
});
