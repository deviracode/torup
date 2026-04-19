import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { verifySignature, parseWebhookPayload } from "../webhook.js";
import { detectLanguage } from "../language.js";
import {
  getSession,
  createSession,
  addMessage,
  updateSession,
} from "../session.js";
import { getTemplate } from "../templates.js";

describe("Webhook Signature Verification", () => {
  const appSecret = "test-secret-key";

  it("should accept valid signature", () => {
    const payload = '{"test":"data"}';
    const sig =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(payload).digest("hex");

    expect(verifySignature(payload, sig, appSecret)).toBe(true);
  });

  it("should reject invalid signature", () => {
    const payload = '{"test":"data"}';
    const sig =
      "sha256=" +
      crypto.createHmac("sha256", "wrong-secret").update(payload).digest("hex");

    expect(verifySignature(payload, sig, appSecret)).toBe(false);
  });

  it("should reject missing signature", () => {
    expect(verifySignature("payload", undefined, appSecret)).toBe(false);
  });
});

describe("Webhook Payload Parsing", () => {
  it("should parse text messages from webhook payload", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "123",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "biz-phone-123" },
                messages: [
                  {
                    from: "972501234567",
                    id: "msg-001",
                    timestamp: "1680000000",
                    type: "text",
                    text: { body: "שלום, אני רוצה לקבוע תור" },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const messages = parseWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe("972501234567");
    expect(messages[0].text).toBe("שלום, אני רוצה לקבוע תור");
    expect(messages[0].businessPhoneNumberId).toBe("biz-phone-123");
  });

  it("should return empty array for non-message events", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: "msg-001", status: "delivered" }],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    expect(parseWebhookPayload(payload)).toHaveLength(0);
  });

  it("should handle empty payload", () => {
    expect(parseWebhookPayload({})).toHaveLength(0);
  });

  it("should parse multiple messages", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "biz-1" },
                messages: [
                  { from: "111", id: "m1", timestamp: "1", type: "text", text: { body: "hello" } },
                  { from: "222", id: "m2", timestamp: "2", type: "text", text: { body: "hi" } },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseWebhookPayload(payload);
    expect(messages).toHaveLength(2);
  });

  it("should ignore non-text message types", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "biz-1" },
                messages: [
                  { from: "111", id: "m1", timestamp: "1", type: "image" },
                  { from: "222", id: "m2", timestamp: "2", type: "text", text: { body: "hello" } },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("hello");
  });
});

describe("Language Detection", () => {
  it("should detect Hebrew", () => {
    expect(detectLanguage("שלום, אני רוצה לקבוע תור")).toBe("he");
  });

  it("should detect Arabic", () => {
    expect(detectLanguage("مرحبا، أريد حجز موعد")).toBe("ar");
  });

  it("should detect English", () => {
    expect(detectLanguage("Hello, I want to book an appointment")).toBe("en");
  });

  it("should default to Hebrew for empty string", () => {
    expect(detectLanguage("")).toBe("he");
  });

  it("should handle mixed text with Hebrew majority", () => {
    expect(detectLanguage("שלום מה שלומך היום")).toBe("he");
  });
});

describe("Session Management", () => {
  const phone = "972501234567";
  const bizPhone = "biz-phone-123";

  it("should create and retrieve a session", () => {
    const session = createSession(phone, bizPhone, "business-1", "he");
    expect(session.phoneNumber).toBe(phone);
    expect(session.businessId).toBe("business-1");
    expect(session.language).toBe("he");
    expect(session.messages).toHaveLength(0);

    const retrieved = getSession(phone, bizPhone);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.businessId).toBe("business-1");
  });

  it("should add messages to session", () => {
    createSession(phone, "biz-2", "business-2", "en");
    addMessage(phone, "biz-2", "user", "Hello");
    addMessage(phone, "biz-2", "assistant", "Hi there!");

    const session = getSession(phone, "biz-2");
    expect(session!.messages).toHaveLength(2);
    expect(session!.messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(session!.messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
  });

  it("should update session properties", () => {
    createSession("999", "biz-3", "business-3", "he");
    updateSession("999", "biz-3", { language: "ar" });

    const session = getSession("999", "biz-3");
    expect(session!.language).toBe("ar");
  });

  it("should return null for non-existent session", () => {
    expect(getSession("nonexistent", "nope")).toBeNull();
  });

  it("should expire sessions after TTL", () => {
    vi.useFakeTimers();
    createSession("ttl-test", "biz-ttl", "b1", "en");

    // Advance 31 minutes
    vi.advanceTimersByTime(31 * 60 * 1000);

    expect(getSession("ttl-test", "biz-ttl")).toBeNull();
    vi.useRealTimers();
  });
});

describe("Message Templates", () => {
  const vars = {
    customer_name: "John",
    business_name: "Cool Barber",
    service_name: "Haircut",
    date: "2026-04-01",
    time: "10:00",
  };

  it("should render all template types without error", () => {
    const types = [
      "booking_confirmation",
      "reminder_24h",
      "reminder_2h",
      "cancellation",
      "reschedule",
    ] as const;

    for (const type of types) {
      for (const lang of ["he", "ar", "en"] as const) {
        const result = getTemplate(type, lang, vars);
        expect(result).toBeTruthy();
        expect(result).not.toContain("{customer_name}");
        expect(result).not.toContain("{business_name}");
      }
    }
  });

  it("should render template with variables substituted", () => {
    const result = getTemplate("booking_confirmation", "en", vars);
    expect(result).toContain("John");
    expect(result).toContain("Haircut");
    expect(result).toContain("Cool Barber");
    expect(result).toContain("10:00");
  });

  it("should render Hebrew template", () => {
    const result = getTemplate("booking_confirmation", "he", {
      customer_name: "יוסי",
      business_name: "מספרה",
      service_name: "תספורת",
      date: "2026-04-01",
      time: "10:00",
    });

    expect(result).toContain("יוסי");
    expect(result).toContain("תספורת");
  });

  it("should render Arabic cancellation template", () => {
    const result = getTemplate("cancellation", "ar", {
      customer_name: "أحمد",
      business_name: "صالون",
      service_name: "حلاقة",
      date: "2026-04-01",
      time: "14:00",
    });

    expect(result).toContain("صالون");
    expect(result).toContain("حلاقة");
  });
});
