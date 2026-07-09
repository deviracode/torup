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
import { isGreetingName, GREETING_BLOCKLIST } from "../index.js";
import { getTemplate } from "../templates.js";
import { groupTimeSlots } from "../index.js";

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

  it("should parse template quick-reply button taps (type=button)", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "biz-phone-123" },
                messages: [
                  {
                    from: "972501234567",
                    id: "msg-btn-001",
                    timestamp: "1680000000",
                    type: "button",
                    button: { payload: "approve_abc-123", text: "אשר" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const messages = parseWebhookPayload(payload);
    expect(messages).toHaveLength(1);
    expect(messages[0].interactionId).toBe("approve_abc-123");
    expect(messages[0].text).toBe("אשר");
    expect(messages[0].from).toBe("972501234567");
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

describe("groupTimeSlots", () => {
  it("puts slots before 12:00 into morning", () => {
    const slots = [
      { time: "2026-06-01T06:00:00+03:00", label: "06:00" },
      { time: "2026-06-01T09:30:00+03:00", label: "09:30" },
      { time: "2026-06-01T11:59:00+03:00", label: "11:59" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(3);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(0);
  });

  it("puts slots 12:00–15:59 into noon", () => {
    const slots = [
      { time: "2026-06-01T12:00:00+03:00", label: "12:00" },
      { time: "2026-06-01T15:00:00+03:00", label: "15:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(0);
    expect(grouped.noon).toHaveLength(2);
    expect(grouped.evening).toHaveLength(0);
  });

  it("puts slots 16:00+ into evening", () => {
    const slots = [
      { time: "2026-06-01T16:00:00+03:00", label: "16:00" },
      { time: "2026-06-01T20:00:00+03:00", label: "20:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(0);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(2);
  });

  it("distributes mixed slots correctly", () => {
    const slots = [
      { time: "2026-06-01T08:00:00+03:00", label: "08:00" },
      { time: "2026-06-01T13:00:00+03:00", label: "13:00" },
      { time: "2026-06-01T18:00:00+03:00", label: "18:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(1);
    expect(grouped.noon).toHaveLength(1);
    expect(grouped.evening).toHaveLength(1);
  });

  it("returns empty arrays for empty input", () => {
    const grouped = groupTimeSlots([]);
    expect(grouped.morning).toHaveLength(0);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(0);
  });
});

describe("groupTimeSlots period detection", () => {
  it("puts 08:00 in morning", () => {
    const slots = [
      { time: "2026-07-10T06:00:00.000Z", label: "08:00" },
      { time: "2026-07-10T07:00:00.000Z", label: "09:00" },
    ];
    const grouped = groupTimeSlots(slots);
    expect(grouped.morning).toHaveLength(2);
    expect(grouped.noon).toHaveLength(0);
    expect(grouped.evening).toHaveLength(0);
  });

  it("puts 17:00 in evening", () => {
    const slots = [{ time: "2026-07-10T14:00:00.000Z", label: "17:00" }];
    const grouped = groupTimeSlots(slots);
    expect(grouped.evening).toHaveLength(1);
    expect(grouped.morning).toHaveLength(0);
  });

  it("puts 13:00 in noon", () => {
    const slots = [{ time: "2026-07-10T10:00:00.000Z", label: "13:00" }];
    const grouped = groupTimeSlots(slots);
    expect(grouped.noon).toHaveLength(1);
  });
});

// ── Bug 2: greeting names ─────────────────────────────────────────────────────
describe("isGreetingName — Bug 2: greeting names rejected as customer names", () => {
  it("flags Arabic greetings", () => {
    expect(isGreetingName("مرحبا")).toBe(true);
    expect(isGreetingName("مرحباً")).toBe(true);
    expect(isGreetingName("هلا")).toBe(true);
    expect(isGreetingName("هلو")).toBe(true);
    expect(isGreetingName("سلام")).toBe(true);
    expect(isGreetingName("أهلا")).toBe(true);
    expect(isGreetingName("أهلاً")).toBe(true);
    expect(isGreetingName("السلام")).toBe(true);
  });

  it("flags Hebrew greetings", () => {
    expect(isGreetingName("שלום")).toBe(true);
    expect(isGreetingName("היי")).toBe(true);
    expect(isGreetingName("הי")).toBe(true);
    expect(isGreetingName("אהלן")).toBe(true);
  });

  it("flags English greetings case-insensitively", () => {
    expect(isGreetingName("hi")).toBe(true);
    expect(isGreetingName("Hi")).toBe(true);
    expect(isGreetingName("HI")).toBe(true);
    expect(isGreetingName("hello")).toBe(true);
    expect(isGreetingName("Hello")).toBe(true);
    expect(isGreetingName("hey")).toBe(true);
  });

  it("accepts real names", () => {
    expect(isGreetingName("דנה לוי")).toBe(false);
    expect(isGreetingName("محمد علي")).toBe(false);
    expect(isGreetingName("Sara Cohen")).toBe(false);
    expect(isGreetingName("יוסי")).toBe(false);
    expect(isGreetingName("Lior")).toBe(false);
  });

  it("accepts names that start with a greeting word but are longer", () => {
    // "שלום כהן" is a real Israeli name — should NOT be blocked
    expect(isGreetingName("שלום כהן")).toBe(false);
    expect(isGreetingName("Salam Aboud")).toBe(false);
  });

  it("returns false for empty string (handled separately upstream)", () => {
    expect(isGreetingName("")).toBe(false);
  });

  it("nameNeedsCapture logic: empty OR greeting triggers awaitingName", () => {
    const nameNeedsCapture = (name: string) => !name || isGreetingName(name);
    expect(nameNeedsCapture("")).toBe(true);          // empty → ask
    expect(nameNeedsCapture("مرحبا")).toBe(true);     // greeting → ask
    expect(nameNeedsCapture("שלום")).toBe(true);      // greeting → ask
    expect(nameNeedsCapture("דנה לוי")).toBe(false);  // real name → don't ask
  });

  it("GREETING_BLOCKLIST covers the exact strings reported in production", () => {
    // These were the names literally saved in the DB
    expect(GREETING_BLOCKLIST.has("مرحبا")).toBe(true);
    expect(GREETING_BLOCKLIST.has("הי")).toBe(true);
    expect(GREETING_BLOCKLIST.has("שלום")).toBe(true);
  });
});
