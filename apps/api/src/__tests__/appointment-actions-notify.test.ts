import { describe, it, expect, vi, beforeEach } from "vitest";

const TARGET_ID = "apt-target";
const BUSINESS_ID = "biz-1";

const { mockSendApprovalNotification, mockSendRejectionNotification } = vi.hoisted(() => ({
  mockSendApprovalNotification: vi.fn(),
  mockSendRejectionNotification: vi.fn(),
}));

vi.mock("../services/notifications.js", () => ({
  sendApprovalNotification: mockSendApprovalNotification,
  sendRejectionNotification: mockSendRejectionNotification,
}));

vi.mock("../services/google-calendar.js", () => ({
  pushAppointmentToGoogle: vi.fn(async () => {}),
}));

vi.mock("../lib/redis.js", () => ({
  cacheClear: vi.fn(async () => {}),
}));

type Apt = { id: string; business_id: string; status: string; start_time: string; end_time: string };
let store: Record<string, Apt>;

function freshStore(): Record<string, Apt> {
  return {
    [TARGET_ID]: {
      id: TARGET_ID,
      business_id: BUSINESS_ID,
      status: "pending_approval",
      start_time: "2099-01-01T10:00:00Z",
      end_time: "2099-01-01T10:30:00Z",
    },
  };
}

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from(table: string) {
      if (table !== "appointments") {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) };
      }
      const filters: { field: string; op: string; value: unknown }[] = [];
      const builder: Record<string, unknown> = {};
      const apply = (): Apt[] =>
        Object.values(store).filter((a) =>
          filters.every((f) => {
            const v = (a as Record<string, unknown>)[f.field];
            if (f.op === "eq") return v === f.value;
            if (f.op === "neq") return v !== f.value;
            if (f.op === "lt") return typeof v === "string" && v < (f.value as string);
            if (f.op === "gt") return typeof v === "string" && v > (f.value as string);
            return true;
          })
        );
      builder.select = () => builder;
      builder.eq = (field: string, value: unknown) => { filters.push({ field, op: "eq", value }); return builder; };
      builder.neq = (field: string, value: unknown) => { filters.push({ field, op: "neq", value }); return builder; };
      builder.lt = (field: string, value: unknown) => { filters.push({ field, op: "lt", value }); return builder; };
      builder.gt = (field: string, value: unknown) => { filters.push({ field, op: "gt", value }); return builder; };
      builder.single = async () => {
        const rows = apply();
        return { data: rows[0] || null, error: rows[0] ? null : { message: "not found" } };
      };
      builder.then = (resolve: (v: { data: Apt[]; error: null }) => void) => resolve({ data: apply(), error: null });
      builder.update = (patch: Record<string, unknown>) => ({
        eq: (field: string, value: unknown) => {
          for (const a of Object.values(store)) {
            if ((a as Record<string, unknown>)[field] === value) Object.assign(a, patch);
          }
          return Promise.resolve({ error: null });
        },
      });
      return builder;
    },
  }),
}));

describe("customerNotified in approve/reject results", () => {
  beforeEach(() => {
    store = freshStore();
    mockSendApprovalNotification.mockReset();
    mockSendRejectionNotification.mockReset();
  });

  it("approveAppointment returns customerNotified: true when the send succeeds", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: true, failed: false });
    const { approveAppointment } = await import("../services/appointment-actions.js");

    const result = await approveAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(true);
  });

  it("approveAppointment returns customerNotified: false when the send fails", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: false, failed: true });
    const { approveAppointment } = await import("../services/appointment-actions.js");

    const result = await approveAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(false);
    expect(result.approved).toBe(TARGET_ID);
  });

  it("approveAppointment returns customerNotified: false without throwing when the send rejects", async () => {
    mockSendApprovalNotification.mockRejectedValue(new Error("network error"));
    const { approveAppointment } = await import("../services/appointment-actions.js");

    const result = await approveAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(false);
  });

  it("rejectAppointment returns customerNotified: true when the send succeeds", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: true, failed: false });
    const { rejectAppointment } = await import("../services/appointment-actions.js");

    const result = await rejectAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(true);
    expect(result.rejected).toBe(TARGET_ID);
  });

  it("rejectAppointment returns customerNotified: false when the send fails", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: false, failed: true });
    const { rejectAppointment } = await import("../services/appointment-actions.js");

    const result = await rejectAppointment(TARGET_ID);

    expect(result.customerNotified).toBe(false);
  });
});
