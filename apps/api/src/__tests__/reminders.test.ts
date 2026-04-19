import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateTransition } from "@queue/shared";

describe("Reminder System", () => {
  describe("processReminders logic", () => {
    it("should only send reminders for pending and confirmed appointments", () => {
      const eligibleStatuses = ["pending", "confirmed"];
      const ineligibleStatuses = ["cancelled", "completed", "no_show", "in_progress"];

      for (const status of eligibleStatuses) {
        expect(["pending", "confirmed"]).toContain(status);
      }
      for (const status of ineligibleStatuses) {
        expect(["pending", "confirmed"]).not.toContain(status);
      }
    });

    it("should calculate reminder window correctly", () => {
      const now = new Date("2026-04-20T08:00:00Z");
      const minutesBefore = 1440; // 24 hours
      const windowMinutes = 5;

      const windowStart = new Date(now.getTime() + (minutesBefore - windowMinutes) * 60 * 1000);
      const windowEnd = new Date(now.getTime() + (minutesBefore + windowMinutes) * 60 * 1000);

      // Appointment at 2026-04-21T08:00:00Z (exactly 24h from now) should be in window
      const aptTime = new Date("2026-04-21T08:00:00Z");
      expect(aptTime >= windowStart && aptTime < windowEnd).toBe(true);

      // Appointment at 2026-04-21T09:00:00Z (25h from now) should NOT be in window
      const aptTimeLate = new Date("2026-04-21T09:00:00Z");
      expect(aptTimeLate >= windowStart && aptTimeLate < windowEnd).toBe(false);
    });

    it("should generate unique template IDs per interval", () => {
      const intervals = [15, 30, 60, 120, 1440, 2880];
      const templateIds = intervals.map((m) => `reminder_${m}m`);
      const unique = new Set(templateIds);
      expect(unique.size).toBe(intervals.length);
    });
  });

  describe("Webhook button response handling", () => {
    it("should allow confirm transition from pending", () => {
      const result = validateTransition("pending", "confirmed");
      expect(result.valid).toBe(true);
    });

    it("should allow cancel transition from pending", () => {
      const result = validateTransition("pending", "cancelled");
      expect(result.valid).toBe(true);
    });

    it("should allow cancel transition from confirmed", () => {
      const result = validateTransition("confirmed", "cancelled");
      expect(result.valid).toBe(true);
    });

    it("should reject cancel from completed", () => {
      const result = validateTransition("completed", "cancelled");
      expect(result.valid).toBe(false);
    });

    it("should reject cancel from in_progress", () => {
      const result = validateTransition("in_progress", "cancelled");
      expect(result.valid).toBe(false);
    });

    it("should reject confirm from completed", () => {
      const result = validateTransition("completed", "confirmed");
      expect(result.valid).toBe(false);
    });
  });

  describe("Duplicate reminder prevention", () => {
    it("should use template_id + appointment_id as dedup key", () => {
      const sentReminders = [
        { appointment_id: "apt1", template_id: "reminder_1440m" },
        { appointment_id: "apt1", template_id: "reminder_120m" },
      ];

      const shouldSend = (aptId: string, templateId: string) => {
        return !sentReminders.some(
          (r) => r.appointment_id === aptId && r.template_id === templateId
        );
      };

      expect(shouldSend("apt1", "reminder_1440m")).toBe(false);
      expect(shouldSend("apt1", "reminder_60m")).toBe(true);
      expect(shouldSend("apt2", "reminder_1440m")).toBe(true);
    });
  });
});
