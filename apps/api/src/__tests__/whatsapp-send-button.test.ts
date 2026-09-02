import { describe, it, expect, vi, afterEach } from "vitest";

describe("whatsapp send functions include URL button component", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetModules();
  });

  it("sendCustomerReminderTemplate includes a URL button component with the appointment's locale and token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.1" }] }) });
    global.fetch = fetchMock as any;
    const { sendCustomerReminderTemplate } = await import("../services/whatsapp");

    await sendCustomerReminderTemplate(
      { phoneNumberId: "pn1", accessToken: "tok" },
      "0501234567",
      { businessName: "Studio", serviceName: "Haircut", date: "30.08.2026", time: "08:00" },
      "he",
      { locale: "he", token: "abc123" }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const buttonComponent = body.template.components.find((c: any) => c.type === "button");
    expect(buttonComponent).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        { type: "text", text: "he" },
        { type: "text", text: "abc123" },
      ],
    });
  });

  it("sendCustomerApprovalTemplate includes a URL button component with the appointment's locale and token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.1" }] }) });
    global.fetch = fetchMock as any;
    const { sendCustomerApprovalTemplate } = await import("../services/whatsapp");

    await sendCustomerApprovalTemplate(
      { phoneNumberId: "pn1", accessToken: "tok" },
      "0501234567",
      { customerName: "Dana", serviceName: "Haircut", date: "30.08.2026", time: "08:00" },
      "ar",
      { locale: "ar", token: "xyz789" }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const buttonComponent = body.template.components.find((c: any) => c.type === "button");
    expect(buttonComponent).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        { type: "text", text: "ar" },
        { type: "text", text: "xyz789" },
      ],
    });
  });
});
