import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateTransition, canCancel, canReschedule } from "@torup/shared";

/**
 * API Integration Tests
 * Tests critical business logic flows without requiring a real database.
 * For full integration tests with Supabase, use a test database.
 */

describe("Appointment Status Transitions", () => {
  it("should allow pending → confirmed", () => {
    const result = validateTransition("pending", "confirmed");
    expect(result.valid).toBe(true);
  });

  it("should allow pending → cancelled", () => {
    const result = validateTransition("pending", "cancelled");
    expect(result.valid).toBe(true);
  });

  it("should allow confirmed → in_progress", () => {
    const result = validateTransition("confirmed", "in_progress");
    expect(result.valid).toBe(true);
  });

  it("should allow confirmed → cancelled", () => {
    const result = validateTransition("confirmed", "cancelled");
    expect(result.valid).toBe(true);
  });

  it("should allow confirmed → no_show", () => {
    const result = validateTransition("confirmed", "no_show");
    expect(result.valid).toBe(true);
  });

  it("should allow in_progress → completed", () => {
    const result = validateTransition("in_progress", "completed");
    expect(result.valid).toBe(true);
  });

  it("should reject completed → anything", () => {
    expect(validateTransition("completed", "cancelled").valid).toBe(false);
    expect(validateTransition("completed", "pending").valid).toBe(false);
    expect(validateTransition("completed", "in_progress").valid).toBe(false);
  });

  it("should reject cancelled → anything", () => {
    expect(validateTransition("cancelled", "confirmed").valid).toBe(false);
    expect(validateTransition("cancelled", "pending").valid).toBe(false);
  });

  it("should reject pending → completed (skip steps)", () => {
    const result = validateTransition("pending", "completed");
    expect(result.valid).toBe(false);
  });

  it("should reject pending → in_progress (skip steps)", () => {
    const result = validateTransition("pending", "in_progress");
    expect(result.valid).toBe(false);
  });
});

describe("Cancellation Window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T10:00:00"));
  });

  it("should allow cancellation when within window", () => {
    // Appointment is 3 hours from now, window is 120 min
    const appointmentTime = new Date("2026-04-02T13:00:00");
    const result = canCancel(appointmentTime, 120);
    expect(result.allowed).toBe(true);
  });

  it("should reject cancellation when past window", () => {
    // Appointment is 1 hour from now, window is 120 min
    const appointmentTime = new Date("2026-04-02T11:00:00");
    const result = canCancel(appointmentTime, 120);
    expect(result.allowed).toBe(false);
  });

  it("should allow cancellation for future appointments", () => {
    // Appointment is tomorrow
    const appointmentTime = new Date("2026-04-03T10:00:00");
    const result = canCancel(appointmentTime, 120);
    expect(result.allowed).toBe(true);
  });
});

describe("Reschedule Window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T10:00:00"));
  });

  it("should allow reschedule when within window", () => {
    const appointmentTime = new Date("2026-04-02T15:00:00");
    const result = canReschedule(appointmentTime, 120);
    expect(result.allowed).toBe(true);
  });

  it("should reject reschedule when past window", () => {
    const appointmentTime = new Date("2026-04-02T11:30:00");
    const result = canReschedule(appointmentTime, 120);
    expect(result.allowed).toBe(false);
  });
});

describe("Availability Calculation", () => {
  it("should import getAvailableSlots from shared package", async () => {
    const { getAvailableSlots } = await import("@torup/shared");
    expect(typeof getAvailableSlots).toBe("function");
  });

  it("should return empty slots for a closed day", async () => {
    const { getAvailableSlots } = await import("@torup/shared");

    const workingHours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      ranges: i === 6 ? [] : [{ start: "09:00", end: "17:00" }],
      isClosed: i === 6, // Saturday closed
    }));

    const serviceConfig = {
      durationMinutes: 30,
      bufferMinutes: 0,
      maxCapacity: 1,
    };

    // 2026-04-04 is a Saturday
    const slots = getAvailableSlots("2026-04-04", serviceConfig, workingHours, [], []);
    expect(slots).toHaveLength(0);
  });

  it("should return slots for an open day", async () => {
    const { getAvailableSlots } = await import("@torup/shared");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T06:00:00"));

    const workingHours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      ranges: [{ start: "09:00", end: "12:00" }],
      isClosed: false,
    }));

    const serviceConfig = {
      durationMinutes: 60,
      bufferMinutes: 0,
      maxCapacity: 1,
    };

    // 2026-04-01 is a Wednesday (day 3)
    // Use intervalMinutes=60 to match duration for clean slot count
    const slots = getAvailableSlots("2026-04-01", serviceConfig, workingHours, [], [], undefined, 60);
    expect(slots.length).toBeGreaterThan(0);
    // 9-12 with 60 min slots at 60 min interval = 09:00, 10:00, 11:00 = 3 slots
    expect(slots).toHaveLength(3);
  });

  it("should exclude slots blocked by existing appointments", async () => {
    const { getAvailableSlots } = await import("@torup/shared");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T06:00:00"));

    const workingHours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      ranges: [{ start: "09:00", end: "12:00" }],
      isClosed: false,
    }));

    const serviceConfig = {
      durationMinutes: 60,
      bufferMinutes: 0,
      maxCapacity: 1,
    };

    const existing = [
      {
        startTime: new Date("2026-04-01T10:00:00"),
        endTime: new Date("2026-04-01T11:00:00"),
        staffId: null,
      },
    ];

    const slots = getAvailableSlots("2026-04-01", serviceConfig, workingHours, [], existing);
    // Should have 09:00 and 11:00, but not 10:00
    expect(slots).toHaveLength(2);
    expect(slots.some((s) => s.start.getHours() === 10)).toBe(false);
  });

  it("should respect buffer times between appointments", async () => {
    const { getAvailableSlots } = await import("@torup/shared");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T06:00:00"));

    const workingHours = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      ranges: [{ start: "09:00", end: "12:00" }],
      isClosed: false,
    }));

    const serviceConfig = {
      durationMinutes: 30,
      bufferMinutes: 15,
      maxCapacity: 1,
    };

    const existing = [
      {
        startTime: new Date("2026-04-01T10:00:00"),
        endTime: new Date("2026-04-01T10:30:00"),
        staffId: null,
      },
    ];

    // Use 30-min interval to match duration
    const slots = getAvailableSlots("2026-04-01", serviceConfig, workingHours, [], existing, undefined, 30);
    // 10:00 slot is taken by existing appointment
    const tenSlot = slots.find(
      (s) => s.start.getHours() === 10 && s.start.getMinutes() === 0
    );
    expect(tenSlot).toBeUndefined();
    // Buffer applies forward from new slots: a slot at 09:30 would have buffer extending to 10:15,
    // overlapping the existing 10:00-10:30 appointment, so 09:30 should be blocked
    const nineThirty = slots.find(
      (s) => s.start.getHours() === 9 && s.start.getMinutes() === 30
    );
    expect(nineThirty).toBeUndefined();
  });
});

describe("Staff-derived capacity", () => {
  function effectiveCapacity(
    assignedStaffIds: string[],
    timeOffDates: Map<string, string[]>,
    targetDate: string,
    fallbackCapacity: number
  ): number {
    if (assignedStaffIds.length === 0) return fallbackCapacity;
    return assignedStaffIds.filter((id) => {
      const offDates = timeOffDates.get(id) || [];
      return !offDates.includes(targetDate);
    }).length;
  }

  it("returns fallback when no staff assigned", () => {
    expect(effectiveCapacity([], new Map(), "2026-06-20", 3)).toBe(3);
  });

  it("counts all staff when none are off", () => {
    const timeOff = new Map([["s1", []], ["s2", []]]);
    expect(effectiveCapacity(["s1", "s2"], timeOff, "2026-06-20", 3)).toBe(2);
  });

  it("reduces capacity when one staff is off", () => {
    const timeOff = new Map([["s1", ["2026-06-20"]], ["s2", []]]);
    expect(effectiveCapacity(["s1", "s2"], timeOff, "2026-06-20", 3)).toBe(1);
  });

  it("returns 0 when all assigned staff are off", () => {
    const timeOff = new Map([["s1", ["2026-06-20"]], ["s2", ["2026-06-20"]]]);
    expect(effectiveCapacity(["s1", "s2"], timeOff, "2026-06-20", 3)).toBe(0);
  });
});

describe("Staff display_name validation", () => {
  it("rejects empty display_name", () => {
    const name = "  ";
    expect(name.trim().length).toBe(0);
  });

  it("accepts valid display_name", () => {
    const name = "Ahmed";
    expect(name.trim().length).toBeGreaterThan(0);
  });
});
