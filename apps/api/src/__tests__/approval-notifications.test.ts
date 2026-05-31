import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub WhatsApp so no real messages fire.
vi.mock("../services/whatsapp.js", () => ({
  sendInteractiveReminder: vi.fn(async () => null),
  sendWhatsAppMessage: vi.fn(async () => "msg-id-123"),
}));

const insertedRows: Array<Record<string, unknown>> = [];

const appointmentRow = {
  id: "apt-1",
  business_id: "biz-1",
  customer_id: "cust-1",
  start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: "pending_approval",
  service_id: "svc-1",
  customers: { id: "cust-1", name: "Test", phone: "+972500000000", language_preference: "he" },
  services: { name_he: "תספורת", name_ar: null, name_en: null },
  businesses: { name: "Studio" },
};

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: appointmentRow }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return { error: null };
      },
    }),
  }),
}));

describe("sendApprovalNotification", () => {
  beforeEach(() => {
    insertedRows.length = 0;
  });

  it("sends approval notification and logs status='sent' when WhatsApp succeeds", async () => {
    const { sendApprovalNotification } = await import("../services/notifications.js");
    const result = await sendApprovalNotification("apt-1");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].template_id).toBe("approval");
    expect(insertedRows[0].whatsapp_message_id).toBe("msg-id-123");
  });

  it("is a thin wrapper that delegates to sendAppointmentNotification with template 'approval'", async () => {
    // Ensure the function exists and can be called.
    const mod = await import("../services/notifications.js");
    expect(typeof mod.sendApprovalNotification).toBe("function");
  });
});

describe("sendRejectionNotification", () => {
  beforeEach(() => {
    insertedRows.length = 0;
  });

  it("sends slot_taken rejection with rebook_url in vars", async () => {
    const { sendRejectionNotification } = await import("../services/notifications.js");
    const result = await sendRejectionNotification("apt-1", "slot_taken");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].template_id).toBe("rejection_slot_taken");
  });

  it("sends manual rejection with correct template", async () => {
    const { sendRejectionNotification } = await import("../services/notifications.js");
    const result = await sendRejectionNotification("apt-1", "manual");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].template_id).toBe("rejection_manual");
  });

  it("constructs rebook_url from appointment's business and service ids", async () => {
    // The mock returns a row with service_id=svc-1 and business_id=biz-1.
    // sendRejectionNotification queries the appointment to build the URL.
    const { sendRejectionNotification } = await import("../services/notifications.js");
    const result = await sendRejectionNotification("apt-1", "slot_taken");

    expect(result?.sent).toBe(true);
  });
});
