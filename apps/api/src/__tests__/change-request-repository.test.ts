import { describe, it, expect, vi } from "vitest";
import { createChangeRequestRepo } from "../modules/appointments/change-request.repository";

function fakeClient(handlers: Record<string, any>) {
  return { from: vi.fn((table: string) => handlers[table]) } as any;
}

describe("change-request repository", () => {
  it("findPendingByAppointment filters by appointment_id and status=pending", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn(() => ({ maybeSingle }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { select } }));

    await repo.findPendingByAppointment("apt-1");

    expect(eq1).toHaveBeenCalledWith("appointment_id", "apt-1");
    expect(eq2).toHaveBeenCalledWith("status", "pending");
  });

  it("create inserts a row with status=pending and returns it", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "req-1", status: "pending" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { insert } }));

    await repo.create({ appointment_id: "apt-1", business_id: "biz-1", type: "cancel", reason: "sick" });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ appointment_id: "apt-1", business_id: "biz-1", type: "cancel", reason: "sick" })
    );
  });

  it("updateStatus sets status, resolved_at, resolved_by", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "req-1", status: "approved" }, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { update } }));

    await repo.updateStatus("req-1", "approved", "user-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", resolved_by: "user-1" })
    );
    expect(eq).toHaveBeenCalledWith("id", "req-1");
  });

  it("findByIdAndBusiness filters by id and business_id (tenant isolation)", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "req-1", business_id: "biz-1" }, error: null });
    const eq2 = vi.fn(() => ({ single }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { select } }));

    await repo.findByIdAndBusiness("req-1", "biz-1");

    expect(eq1).toHaveBeenCalledWith("id", "req-1");
    expect(eq2).toHaveBeenCalledWith("business_id", "biz-1");
  });

  it("listPendingByBusiness filters by business_id and status=pending, ordered by created_at ascending", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq2 = vi.fn(() => ({ order }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const repo = createChangeRequestRepo(fakeClient({ appointment_change_requests: { select } }));

    await repo.listPendingByBusiness("biz-1");

    expect(eq1).toHaveBeenCalledWith("business_id", "biz-1");
    expect(eq2).toHaveBeenCalledWith("status", "pending");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});
