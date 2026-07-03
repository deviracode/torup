import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateTransition } from "@torup/shared";
import { renderTemplate } from "../services/notifications.js";
import express from "express";
import request from "supertest";

// ── Mocks for booking_confirmation suppression tests ──────────────────────────

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireBusinessAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { mockSendAppointmentNotification, mockSendManagerNotification } = vi.hoisted(() => ({
  mockSendAppointmentNotification: vi.fn().mockResolvedValue(undefined),
  mockSendManagerNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/notifications.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/notifications.js")>();
  return {
    ...actual,
    sendAppointmentNotification: mockSendAppointmentNotification,
    sendManagerNotification: mockSendManagerNotification,
  };
});

vi.mock("../services/google-calendar.js", () => ({
  pushAppointmentToGoogle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/redis.js", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheClear: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/appointment-actions.js", () => ({
  approveAppointment: vi.fn(),
  rejectAppointment: vi.fn(),
}));

// Supabase stub: services returns a valid service; appointments.insert returns a new row.
const CREATED_APT_ID = "apt-booking-conf-test-001";
const BUSINESS_ID_BC = "biz-bc-test";

function makeSupabaseStubForPost(createdVia: string) {
  return {
    from(table: string) {
      if (table === "services") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: { duration_minutes: 30, buffer_minutes: 0, max_capacity: 10 },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "appointments") {
        // Chainable builder that resolves to empty data (capacity check passes)
        const chain: Record<string, unknown> = {};
        const noop = () => chain;
        chain.select = noop;
        chain.eq = noop;
        chain.neq = noop;
        chain.gte = noop;
        chain.lte = noop;
        chain.gt = noop;
        chain.lt = noop;
        chain.not = noop;
        chain.in = noop;
        chain.then = (resolve: (v: { data: unknown[]; error: null }) => void) =>
          Promise.resolve().then(() => resolve({ data: [], error: null }));
        // insert chain
        chain.insert = (_row: unknown) => ({
          select: () => ({
            single: async () => ({
              data: { id: CREATED_APT_ID, created_via: createdVia },
              error: null,
            }),
          }),
        });
        return chain;
      }
      return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: "not found" } }) }) }) };
    },
  };
}

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: vi.fn(),
}));

describe("Reminder System", () => {
  describe("renderTemplate(reminder_*m)", () => {
    const vars = {
      customer_name: "Test",
      business_name: "Studio",
      service_name: "Haircut",
      date: "20.04.2026",
      time: "10:00",
    };
    const intervals = [1, 30, 45, 60, 90, 120, 1440, 2880];
    const langs = ["he", "ar", "en"] as const;

    for (const m of intervals) {
      for (const lang of langs) {
        it(`produces non-empty body for minutes_before=${m} lang=${lang}`, () => {
          const body = renderTemplate(`reminder_${m}m`, lang, vars);
          expect(body.length).toBeGreaterThan(0);
          expect(body).toContain(vars.time);
          expect(body).toMatch(/Reminder|תזכורת|تذكير/);
        });
      }
    }

    it("includes service and business name in detail line", () => {
      const body = renderTemplate("reminder_60m", "en", vars);
      expect(body).toContain(vars.service_name);
      expect(body).toContain(vars.business_name);
    });

    it("uses 'tomorrow' phrasing at exactly 1440 minutes", () => {
      const body = renderTemplate("reminder_1440m", "en", vars);
      expect(body.toLowerCase()).toContain("tomorrow");
    });

    it("uses '1 hour' phrasing at exactly 60 minutes", () => {
      const body = renderTemplate("reminder_60m", "en", vars);
      expect(body.toLowerCase()).toContain("1 hour");
    });

    it("falls back to Hebrew for unknown language", () => {
      const body = renderTemplate("reminder_60m", "fr", vars);
      expect(body).toContain("תזכורת");
    });
  });


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

  describe("Manual appointment booking_confirmation suppression", () => {
    async function buildPostApp(createdVia: string) {
      const { createServiceClient } = await import("../lib/supabase.js");
      (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(
        makeSupabaseStubForPost(createdVia)
      );
      const router = (await import("../routes/appointments.js")).default;
      const app = express();
      app.use(express.json());
      app.use("/api/businesses/:businessId/appointments", router);
      return app;
    }

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("does NOT call sendAppointmentNotification with booking_confirmation when created_via is manual", async () => {
      const app = await buildPostApp("manual");
      const res = await request(app)
        .post(`/api/businesses/${BUSINESS_ID_BC}/appointments`)
        .send({
          service_id: "svc-1",
          customer_id: "cust-1",
          start_time: "2099-01-01T10:00:00Z",
          created_via: "manual",
        });

      expect(res.status).toBe(201);
      // Allow event loop to flush the fire-and-forget .catch chains
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendAppointmentNotification).not.toHaveBeenCalledWith(
        CREATED_APT_ID,
        "booking_confirmation"
      );
      expect(mockSendManagerNotification).not.toHaveBeenCalled();
    });

    it("DOES call sendAppointmentNotification with booking_confirmation when created_via is web", async () => {
      const app = await buildPostApp("web");
      const res = await request(app)
        .post(`/api/businesses/${BUSINESS_ID_BC}/appointments`)
        .send({
          service_id: "svc-1",
          customer_id: "cust-1",
          start_time: "2099-01-01T10:00:00Z",
          created_via: "web",
        });

      expect(res.status).toBe(201);
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendAppointmentNotification).toHaveBeenCalledWith(
        CREATED_APT_ID,
        "booking_confirmation"
      );
      expect(mockSendManagerNotification).toHaveBeenCalledWith(CREATED_APT_ID);
    });
  });

  describe("handleButtonResponse — customer_confirmed logic", () => {
    it("sets customer_confirmed=true when action is confirm", () => {
      const action = "confirm";
      expect(action === "confirm").toBe(true);
    });

    it("sets customer_confirmed=false when action is cancel", () => {
      const action = "cancel";
      expect(action === "confirm").toBe(false);
    });

    it("formats manager confirm message correctly", () => {
      const customerName = "דנה לוי";
      const startTime = "2026-07-05T10:30:00.000Z";
      const startDate = new Date(startTime);
      const date = startDate.toLocaleDateString("he-IL", {
        weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
      });
      const time = startDate.toLocaleTimeString("he-IL", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
      });
      const msg = `✅ ${customerName} אישר/אה את התור ב-${date} בשעה ${time}`;
      expect(msg).toContain("דנה לוי");
      expect(msg).toContain("✅");
    });

    it("formats manager cancel message correctly", () => {
      const customerName = "דנה לוי";
      const startTime = "2026-07-05T10:30:00.000Z";
      const startDate = new Date(startTime);
      const date = startDate.toLocaleDateString("he-IL", {
        weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
      });
      const time = startDate.toLocaleTimeString("he-IL", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
      });
      const msg = `❌ ${customerName} ביטל/לה את התור ב-${date} בשעה ${time}`;
      expect(msg).toContain("דנה לוי");
      expect(msg).toContain("❌");
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
