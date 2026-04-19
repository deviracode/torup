import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canTransition,
  validateTransition,
  canCancel,
  canReschedule,
} from "../status-machine.js";

describe("canTransition", () => {
  it("allows pending → confirmed", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
  });

  it("allows pending → cancelled", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
  });

  it("allows confirmed → in_progress", () => {
    expect(canTransition("confirmed", "in_progress")).toBe(true);
  });

  it("allows confirmed → cancelled", () => {
    expect(canTransition("confirmed", "cancelled")).toBe(true);
  });

  it("allows confirmed → no_show", () => {
    expect(canTransition("confirmed", "no_show")).toBe(true);
  });

  it("allows in_progress → completed", () => {
    expect(canTransition("in_progress", "completed")).toBe(true);
  });

  it("rejects completed → cancelled", () => {
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("rejects cancelled → confirmed", () => {
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });

  it("rejects no_show → anything", () => {
    expect(canTransition("no_show", "confirmed")).toBe(false);
    expect(canTransition("no_show", "completed")).toBe(false);
  });
});

describe("validateTransition", () => {
  it("returns valid for allowed transition", () => {
    const result = validateTransition("pending", "confirmed");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error for same status", () => {
    const result = validateTransition("pending", "pending");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("already");
  });

  it("returns error with valid options for invalid transition", () => {
    const result = validateTransition("pending", "completed");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("confirmed");
  });

  it("returns terminal error for completed status", () => {
    const result = validateTransition("completed", "cancelled");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Cannot change");
  });
});

describe("canCancel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T10:00:00"));
  });

  it("allows cancellation within window", () => {
    const appointmentTime = new Date("2026-04-01T14:00:00"); // 4 hours from now
    const result = canCancel(appointmentTime, 120); // 2 hour window
    expect(result.allowed).toBe(true);
  });

  it("rejects cancellation outside window", () => {
    const appointmentTime = new Date("2026-04-01T11:00:00"); // 1 hour from now
    const result = canCancel(appointmentTime, 120); // 2 hour window
    expect(result.allowed).toBe(false);
    expect(result.error).toContain("120 minutes");
  });
});

describe("canReschedule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T10:00:00"));
  });

  it("allows rescheduling within window", () => {
    const appointmentTime = new Date("2026-04-01T14:00:00");
    const result = canReschedule(appointmentTime, 120);
    expect(result.allowed).toBe(true);
  });

  it("rejects rescheduling outside window", () => {
    const appointmentTime = new Date("2026-04-01T11:00:00");
    const result = canReschedule(appointmentTime, 120);
    expect(result.allowed).toBe(false);
  });
});
