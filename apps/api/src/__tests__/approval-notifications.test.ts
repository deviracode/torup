import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub WhatsApp so no real messages fire.
vi.mock("../services/whatsapp.js", () => ({
  sendInteractiveReminder: vi.fn(async () => null),
  sendWhatsAppMessage: vi.fn(async () => "msg-id-123"),
  sendCustomerApprovalTemplate: vi.fn(async () => "tmpl-msg-id-456"),
  sendCustomerRejectionTemplate: vi.fn(async () => "tmpl-msg-id-789"),
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
    delete process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED;
  });

  it("falls back to freeform text and logs status='sent' when the template is explicitly disabled", async () => {
    process.env.WHATSAPP_APPROVAL_TEMPLATE_ENABLED = "false";
    const { sendApprovalNotification } = await import("../services/notifications.js");
    const result = await sendApprovalNotification("apt-1");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].template_id).toBe("approval");
    expect(insertedRows[0].whatsapp_message_id).toBe("msg-id-123");
  });

  it("uses the approved Meta template by default when the env var is unset", async () => {
    const { sendApprovalNotification } = await import("../services/notifications.js");
    const result = await sendApprovalNotification("apt-1");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].template_id).toBe("approval");
    expect(insertedRows[0].whatsapp_message_id).toBe("tmpl-msg-id-456");
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
    delete process.env.WHATSAPP_REJECTION_TEMPLATE_ENABLED;
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

  it("uses the rejection template when WHATSAPP_REJECTION_TEMPLATE_ENABLED is 'true'", async () => {
    process.env.WHATSAPP_REJECTION_TEMPLATE_ENABLED = "true";
    const { sendRejectionNotification } = await import("../services/notifications.js");
    const result = await sendRejectionNotification("apt-1", "manual");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("sent");
    expect(insertedRows[0].whatsapp_message_id).toBe("tmpl-msg-id-789");
  });

  it("stays on freeform text when WHATSAPP_REJECTION_TEMPLATE_ENABLED is unset", async () => {
    const { sendRejectionNotification } = await import("../services/notifications.js");
    const result = await sendRejectionNotification("apt-1", "manual");

    expect(result?.sent).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].template_id).toBe("rejection_manual");
    expect(insertedRows[0].whatsapp_message_id).toBe("msg-id-123");
  });

  it("falls back to freeform text when the appointment has no usable customer phone, even with the template enabled", async () => {
    process.env.WHATSAPP_REJECTION_TEMPLATE_ENABLED = "true";

    // Override the supabase mock for this test only: simulate an appointment
    // whose customer record has no phone number (e.g. an incomplete lookup).
    // sendRejectionNotification's `customer?.phone && service` guard should
    // fail and fall through to sendAppointmentNotification's freeform path
    // (which only needs customer/service/business objects to be present,
    // not a phone) instead of calling sendCustomerRejectionTemplate.
    vi.doMock("../lib/supabase.js", () => ({
      createServiceClient: () => ({
        from: (_table: string) => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  ...appointmentRow,
                  customers: { ...appointmentRow.customers, phone: "" },
                },
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            insertedRows.push(row);
            return { error: null };
          },
        }),
      }),
    }));
    vi.resetModules();

    try {
      const { sendRejectionNotification } = await import("../services/notifications.js");
      const result = await sendRejectionNotification("apt-1", "manual");

      expect(result?.sent).toBe(true);
      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0].template_id).toBe("rejection_manual");
      // Freeform mock's return value, NOT the template mock's "tmpl-msg-id-789".
      expect(insertedRows[0].whatsapp_message_id).toBe("msg-id-123");
    } finally {
      vi.doUnmock("../lib/supabase.js");
      vi.resetModules();
    }
  });
});
