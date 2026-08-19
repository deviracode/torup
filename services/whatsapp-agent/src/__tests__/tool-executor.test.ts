import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSingle, mockOrder } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockOrder: vi.fn(),
}));

vi.mock("@torup/db", () => ({
  createClient: () => ({
    from(table: string) {
      if (table === "customers") {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      // table === "appointments"
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () => ({
                gte: () => ({
                  order: mockOrder,
                }),
              }),
            }),
          }),
        }),
      };
    },
  }),
}));

import { executeTool } from "../tool-executor.js";

describe("executeTool > list_appointments", () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockOrder.mockReset();
    mockSingle.mockResolvedValue({ data: { id: "cust-1" } });
  });

  it("converts a UTC start_time to Israel local time (summer/DST, UTC+3)", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-08-07T11:00:00+00:00",
          end_time: "2026-08-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");
    const parsed = JSON.parse(result);

    expect(parsed[0].time).toBe("14:00");
  });

  it("converts a UTC start_time to Israel local time (winter/standard, UTC+2)", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-01-07T11:00:00+00:00",
          end_time: "2026-01-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");
    const parsed = JSON.parse(result);

    expect(parsed[0].time).toBe("13:00");
  });

  it("does not include any raw start_time or end_time field in the response", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-08-07T11:00:00+00:00",
          end_time: "2026-08-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");

    expect(result).not.toContain("start_time");
    expect(result).not.toContain("end_time");
  });

  it("resolves service_name by language, falling back to name_he when the localized field is null", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "apt-1",
          start_time: "2026-08-07T11:00:00+00:00",
          end_time: "2026-08-07T11:30:00+00:00",
          status: "confirmed",
          services: { name_he: "תספורת", name_ar: null, name_en: "Haircut" },
        },
      ],
    });

    const enResult = JSON.parse(
      await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en")
    );
    expect(enResult[0].service_name).toBe("Haircut");

    const arResult = JSON.parse(
      await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "ar")
    );
    expect(arResult[0].service_name).toBe("תספורת"); // name_ar is null, falls back to name_he
  });

  it("still returns the no-appointments message when there are none", async () => {
    mockOrder.mockResolvedValue({ data: [] });

    const result = await executeTool("list_appointments", { customer_phone: "0501234567" }, "biz-1", "en");

    expect(result).toBe("No upcoming appointments.");
  });
});
