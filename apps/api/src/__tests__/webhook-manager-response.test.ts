import { describe, it, expect, vi, beforeEach } from "vitest";

const MANAGER_PHONE = "972501234567";
const OWNER_PHONE = "972501234567";
const APPOINTMENT_ID = "apt-1";

const { mockSendWhatsAppMessage, mockSendApprovalNotification, mockSendRejectionNotification } = vi.hoisted(() => ({
  mockSendWhatsAppMessage: vi.fn(async () => "msg-id"),
  mockSendApprovalNotification: vi.fn(),
  mockSendRejectionNotification: vi.fn(),
}));

vi.mock("../services/whatsapp.js", () => ({
  sendWhatsAppMessage: mockSendWhatsAppMessage,
}));

vi.mock("../services/notifications.js", () => ({
  sendApprovalNotification: mockSendApprovalNotification,
  sendRejectionNotification: mockSendRejectionNotification,
}));

const appointmentRow = {
  id: APPOINTMENT_ID,
  status: "pending_approval",
  business_id: "biz-1",
  businesses: { phone: OWNER_PHONE },
};

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: appointmentRow }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
  }),
}));

describe("handleManagerResponse", () => {
  beforeEach(() => {
    mockSendWhatsAppMessage.mockClear();
    mockSendApprovalNotification.mockReset();
    mockSendRejectionNotification.mockReset();
  });

  it("tells the manager the customer WAS notified when the approval send succeeds", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: true, failed: false });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "approve");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "✅ התור אושר! הלקוח יקבל הודעה."
    );
  });

  it("tells the manager the customer was NOT notified when the approval send fails", async () => {
    mockSendApprovalNotification.mockResolvedValue({ sent: false, failed: true });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "approve");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "✅ התור אושר, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות."
    );
  });

  it("tells the manager the customer WAS notified when the rejection send succeeds", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: true, failed: false });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "reject");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "❌ התור נדחה. הלקוח יקבל הודעה."
    );
  });

  it("tells the manager the customer was NOT notified when the rejection send fails", async () => {
    mockSendRejectionNotification.mockResolvedValue({ sent: false, failed: true });
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "reject");

    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "❌ התור נדחה, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות."
    );
  });

  it("does not throw when the notification function resolves undefined", async () => {
    mockSendApprovalNotification.mockResolvedValue(undefined);
    const { handleManagerResponse } = await import("../routes/webhooks.js");

    await expect(
      handleManagerResponse(MANAGER_PHONE, APPOINTMENT_ID, "approve")
    ).resolves.not.toThrow();
    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
      MANAGER_PHONE,
      "✅ התור אושר, אך לא הצלחנו לשלוח הודעה ללקוח. יש ליצור איתו קשר ישירות."
    );
  });
});
