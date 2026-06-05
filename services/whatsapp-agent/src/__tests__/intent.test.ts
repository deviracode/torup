import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractBookingIntent } from "../intent.js";

// Mock the entire @anthropic-ai/sdk module
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

import Anthropic from "@anthropic-ai/sdk";

const SERVICES = [
  { id: "svc-1", name_he: "תספורת", name_ar: "قص شعر", name_en: "Haircut" },
  { id: "svc-2", name_he: "צביעה", name_ar: "صبغ شعر", name_en: "Hair Color" },
];

function mockAnthropicResponse(json: object) {
  const instance = new (Anthropic as any)();
  instance.messages.create.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify(json) }],
  });
  (Anthropic as any).mockImplementation(() => instance);
}

describe("extractBookingIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns high confidence with service+date+time from Arabic message", async () => {
    mockAnthropicResponse({
      service_id: "svc-1",
      date: "2026-07-25",
      time_hour: 17,
      party_size: 1,
      confidence: "high",
    });

    const result = await extractBookingIntent(
      "مرحبا قص شعر ب 25.7 عالخمسه",
      SERVICES,
      "ar",
      "2026-06-05"
    );

    expect(result.confidence).toBe("high");
    expect(result.service_id).toBe("svc-1");
    expect(result.date).toBe("2026-07-25");
    expect(result.time_hour).toBe(17);
    expect(result.party_size).toBe(1);
  });

  it("returns high confidence and detects party_size from plural Arabic", async () => {
    mockAnthropicResponse({
      service_id: "svc-1",
      date: "2026-07-25",
      time_hour: 17,
      party_size: 3,
      confidence: "high",
    });

    const result = await extractBookingIntent(
      "بدنا نكون جاهزات 3 بنات قص شعر 25.7 عالخمسه",
      SERVICES,
      "ar",
      "2026-06-05"
    );

    expect(result.party_size).toBe(3);
    expect(result.confidence).toBe("high");
  });

  it("returns low confidence for vague greeting", async () => {
    mockAnthropicResponse({
      service_id: null,
      date: null,
      time_hour: null,
      party_size: 1,
      confidence: "low",
    });

    const result = await extractBookingIntent("مرحبا", SERVICES, "ar", "2026-06-05");
    expect(result.confidence).toBe("low");
  });

  it("returns low confidence on Claude API error (fallback)", async () => {
    const instance = new (Anthropic as any)();
    instance.messages.create.mockRejectedValue(new Error("API timeout"));
    (Anthropic as any).mockImplementation(() => instance);

    const result = await extractBookingIntent(
      "قص شعر 25.7 الخامسة",
      SERVICES,
      "ar",
      "2026-06-05"
    );
    expect(result.confidence).toBe("low");
    expect(result.service_id).toBeNull();
  });

  it("returns low confidence on malformed JSON from Claude", async () => {
    const instance = new (Anthropic as any)();
    instance.messages.create.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
    });
    (Anthropic as any).mockImplementation(() => instance);

    const result = await extractBookingIntent("test", SERVICES, "ar", "2026-06-05");
    expect(result.confidence).toBe("low");
  });

  it("defaults party_size to 1 when not in response", async () => {
    mockAnthropicResponse({
      service_id: "svc-1",
      date: "2026-07-25",
      time_hour: 10,
      confidence: "high",
      // party_size intentionally missing
    });

    const result = await extractBookingIntent("תספורת 25.7 בעשר", SERVICES, "he", "2026-06-05");
    expect(result.party_size).toBe(1);
  });
});
