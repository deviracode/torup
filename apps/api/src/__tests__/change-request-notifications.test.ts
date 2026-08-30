import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockSendWhatsAppMessage } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSendWhatsAppMessage: vi.fn().mockResolvedValue("wamid.1"),
}));

vi.mock("../lib/supabase", () => ({ createServiceClient: () => ({ from: mockFrom }) }));
vi.mock("../services/whatsapp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/whatsapp")>();
  return { ...actual, sendWhatsAppMessage: mockSendWhatsAppMessage };
});

function chain(data: any) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn(() => ({ single, eq: vi.fn(() => ({ single })) }));
  const select = vi.fn(() => ({ eq }));
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  return { select, insert };
}

const credentialRow = {
  id: "cred-1",
  business_id: "biz-1",
  phone_number_id: "pn-1",
  access_token: "tok",
  app_secret: null,
  verify_token: null,
  display_phone: null,
  verified_at: "2026-01-01T00:00:00Z",
  is_active: true,
};

describe("change-request notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sendChangeRequestOwnerNotification sends to the business's phone", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "appointment_change_requests") {
        return chain({ id: "req-1", type: "cancel", appointment_id: "apt-1", business_id: "biz-1" });
      }
      if (table === "appointments") {
        return chain({ id: "apt-1", start_time: "2099-01-01T10:00:00Z", customers: { name: "Dana" }, services: { name_he: "תספורת" } });
      }
      if (table === "businesses") {
        return chain({ name: "Studio", phone: "972501111111" });
      }
      if (table === "whatsapp_credentials") {
        return chain(credentialRow);
      }
      return chain(null);
    });
    const { sendChangeRequestOwnerNotification } = await import("../services/notifications");
    await sendChangeRequestOwnerNotification("req-1");
    expect(mockSendWhatsAppMessage).toHaveBeenCalled();
  });

  it("sendAttendanceOwnerNotification sends to the business's phone", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "appointments") {
        return chain({
          id: "apt-1",
          business_id: "biz-1",
          start_time: "2099-01-01T10:00:00Z",
          customers: { name: "Dana" },
          services: { name_he: "תספורת" },
        });
      }
      if (table === "businesses") {
        return chain({ name: "Studio", phone: "972501111111" });
      }
      if (table === "whatsapp_credentials") {
        return chain(credentialRow);
      }
      return chain(null);
    });
    const { sendAttendanceOwnerNotification } = await import("../services/notifications");
    await sendAttendanceOwnerNotification("apt-1", "confirm");
    expect(mockSendWhatsAppMessage).toHaveBeenCalled();
  });

  it("sendChangeRequestResolutionNotification sends to the customer's phone", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "appointment_change_requests") {
        return chain({
          id: "req-1",
          type: "cancel",
          appointment_id: "apt-1",
          business_id: "biz-1",
          proposed_start_time: null,
        });
      }
      if (table === "appointments") {
        return chain({
          id: "apt-1",
          customers: { id: "cust-1", name: "Dana", phone: "972502222222", language_preference: "he" },
        });
      }
      if (table === "whatsapp_credentials") {
        return chain(credentialRow);
      }
      if (table === "notifications_log") {
        return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      return chain(null);
    });
    const { sendChangeRequestResolutionNotification } = await import("../services/notifications");
    await sendChangeRequestResolutionNotification("req-1", "approved");
    expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(expect.anything(), "972502222222", expect.any(String));
  });
});
