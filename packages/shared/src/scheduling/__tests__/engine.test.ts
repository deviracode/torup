import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getAvailableSlots,
  getSuggestedSlots,
  getWorkableRanges,
  checkConflict,
  countOverlapping,
  timeToMinutes,
  minutesToTime,
} from "../engine.js";
import type {
  WorkingDay,
  BreakPeriod,
  ExistingAppointment,
  ServiceConfig,
} from "../types.js";

// Mock "now" to a fixed time for consistent tests
const MOCK_NOW = new Date("2026-04-01T08:00:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MOCK_NOW);
});

// Test data
const standardWorkingHours: WorkingDay[] = [
  { dayOfWeek: 0, ranges: [{ start: "09:00", end: "17:00" }], isClosed: false }, // Sunday
  { dayOfWeek: 1, ranges: [{ start: "09:00", end: "17:00" }], isClosed: false },
  { dayOfWeek: 2, ranges: [{ start: "09:00", end: "17:00" }], isClosed: false },
  { dayOfWeek: 3, ranges: [{ start: "09:00", end: "17:00" }], isClosed: false },
  { dayOfWeek: 4, ranges: [{ start: "09:00", end: "17:00" }], isClosed: false },
  { dayOfWeek: 5, ranges: [{ start: "09:00", end: "14:00" }], isClosed: false }, // Friday
  { dayOfWeek: 6, ranges: [], isClosed: true }, // Saturday closed
];

const haircut: ServiceConfig = {
  durationMinutes: 30,
  bufferMinutes: 5,
  maxCapacity: 3,
};

describe("timeToMinutes / minutesToTime", () => {
  it("converts time string to minutes", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("13:30")).toBe(810);
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("converts minutes back to time string", () => {
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(810)).toBe("13:30");
    expect(minutesToTime(0)).toBe("00:00");
  });
});

describe("getWorkableRanges", () => {
  it("returns working ranges for an open day", () => {
    const ranges = getWorkableRanges("2026-04-05", standardWorkingHours, []);
    // April 5, 2026 is a Sunday (day 0)
    expect(ranges).toEqual([{ start: "09:00", end: "17:00" }]);
  });

  it("returns empty for a closed day", () => {
    const ranges = getWorkableRanges("2026-04-04", standardWorkingHours, []);
    // April 4, 2026 is a Saturday (day 6)
    expect(ranges).toEqual([]);
  });

  it("subtracts a lunch break", () => {
    const breaks: BreakPeriod[] = [
      { type: "recurring", dayOfWeek: 0, start: "13:00", end: "14:00" },
    ];
    const ranges = getWorkableRanges("2026-04-05", standardWorkingHours, breaks);
    expect(ranges).toEqual([
      { start: "09:00", end: "13:00" },
      { start: "14:00", end: "17:00" },
    ]);
  });

  it("handles one-time holiday closure", () => {
    const breaks: BreakPeriod[] = [
      { type: "one_time", specificDate: "2026-04-05", start: "00:00", end: "23:59" },
    ];
    const ranges = getWorkableRanges("2026-04-05", standardWorkingHours, breaks);
    expect(ranges).toEqual([]);
  });

  it("handles split working hours", () => {
    const splitHours: WorkingDay[] = [
      {
        dayOfWeek: 0,
        ranges: [
          { start: "09:00", end: "13:00" },
          { start: "16:00", end: "20:00" },
        ],
        isClosed: false,
      },
    ];
    const ranges = getWorkableRanges("2026-04-05", splitHours, []);
    expect(ranges).toEqual([
      { start: "09:00", end: "13:00" },
      { start: "16:00", end: "20:00" },
    ]);
  });
});

describe("countOverlapping / checkConflict", () => {
  const appointments: ExistingAppointment[] = [
    {
      startTime: new Date("2026-04-05T10:00:00"),
      endTime: new Date("2026-04-05T10:30:00"),
    },
    {
      startTime: new Date("2026-04-05T10:00:00"),
      endTime: new Date("2026-04-05T10:30:00"),
    },
  ];

  it("counts overlapping appointments", () => {
    const count = countOverlapping(
      new Date("2026-04-05T10:00:00"),
      new Date("2026-04-05T10:30:00"),
      appointments
    );
    expect(count).toBe(2);
  });

  it("returns 0 for non-overlapping time", () => {
    const count = countOverlapping(
      new Date("2026-04-05T11:00:00"),
      new Date("2026-04-05T11:30:00"),
      appointments
    );
    expect(count).toBe(0);
  });

  it("detects conflict when at capacity", () => {
    expect(
      checkConflict(
        new Date("2026-04-05T10:00:00"),
        new Date("2026-04-05T10:30:00"),
        appointments,
        2
      )
    ).toBe(true);
  });

  it("no conflict when under capacity", () => {
    expect(
      checkConflict(
        new Date("2026-04-05T10:00:00"),
        new Date("2026-04-05T10:30:00"),
        appointments,
        3
      )
    ).toBe(false);
  });
});

describe("getAvailableSlots", () => {
  it("returns slots for a day with no bookings", () => {
    const slots = getAvailableSlots(
      "2026-04-05",
      haircut,
      standardWorkingHours,
      [],
      []
    );

    // 09:00 to 16:30, every 15 minutes => many slots
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].start).toEqual(new Date("2026-04-05T09:00:00"));
    expect(slots[0].end).toEqual(new Date("2026-04-05T09:30:00"));
    expect(slots[0].availableCapacity).toBe(3);
  });

  it("reduces capacity when appointments exist", () => {
    const appointments: ExistingAppointment[] = [
      {
        startTime: new Date("2026-04-05T10:00:00"),
        endTime: new Date("2026-04-05T10:35:00"), // 30 min + 5 min buffer
      },
      {
        startTime: new Date("2026-04-05T10:00:00"),
        endTime: new Date("2026-04-05T10:35:00"),
      },
    ];

    const slots = getAvailableSlots(
      "2026-04-05",
      haircut,
      standardWorkingHours,
      [],
      appointments
    );

    const tenAmSlot = slots.find(
      (s) => s.start.getTime() === new Date("2026-04-05T10:00:00").getTime()
    );

    expect(tenAmSlot).toBeDefined();
    expect(tenAmSlot!.availableCapacity).toBe(1);
  });

  it("excludes fully booked slots", () => {
    const appointments: ExistingAppointment[] = [
      {
        startTime: new Date("2026-04-05T10:00:00"),
        endTime: new Date("2026-04-05T10:35:00"),
      },
      {
        startTime: new Date("2026-04-05T10:00:00"),
        endTime: new Date("2026-04-05T10:35:00"),
      },
      {
        startTime: new Date("2026-04-05T10:00:00"),
        endTime: new Date("2026-04-05T10:35:00"),
      },
    ];

    const slots = getAvailableSlots(
      "2026-04-05",
      haircut,
      standardWorkingHours,
      [],
      appointments
    );

    const tenAmSlot = slots.find(
      (s) => s.start.getTime() === new Date("2026-04-05T10:00:00").getTime()
    );

    expect(tenAmSlot).toBeUndefined();
  });

  it("returns no slots for closed day", () => {
    const slots = getAvailableSlots(
      "2026-04-04", // Saturday
      haircut,
      standardWorkingHours,
      [],
      []
    );

    expect(slots).toEqual([]);
  });

  it("respects breaks", () => {
    const breaks: BreakPeriod[] = [
      { type: "recurring", dayOfWeek: 0, start: "13:00", end: "14:00" },
    ];

    const slots = getAvailableSlots(
      "2026-04-05",
      haircut,
      standardWorkingHours,
      breaks,
      []
    );

    // No slots should start between 13:00 and 14:00
    const breakSlots = slots.filter((s) => {
      const hour = s.start.getHours();
      const min = s.start.getMinutes();
      const startMinutes = hour * 60 + min;
      return startMinutes >= 780 && startMinutes < 840; // 13:00-14:00
    });

    expect(breakSlots).toEqual([]);
  });

  it("enforces minimum advance booking time", () => {
    const rules = {
      minAdvanceMinutes: 120,
      maxFutureDays: 30,
      cancellationWindowMinutes: 120,
      rescheduleWindowMinutes: 120,
    };

    // Now is 08:00, so min advance is 10:00
    const slots = getAvailableSlots(
      "2026-04-01", // Today
      haircut,
      [{ dayOfWeek: 3, ranges: [{ start: "09:00", end: "17:00" }], isClosed: false }],
      [],
      [],
      rules
    );

    // All slots should be at or after 10:00
    for (const slot of slots) {
      expect(slot.start.getHours()).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("getSuggestedSlots", () => {
  it("returns nearest available slots sorted by distance", () => {
    const suggestions = getSuggestedSlots(
      "2026-04-05",
      600, // 10:00
      haircut,
      standardWorkingHours,
      [],
      [],
      undefined,
      3
    );

    expect(suggestions.length).toBe(3);
    // First suggestion should be closest to 10:00
    expect(suggestions[0].distanceMinutes).toBeLessThanOrEqual(
      suggestions[1].distanceMinutes
    );
  });
});
