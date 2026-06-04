import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../services/whatsapp.js", () => ({
  sendInteractiveReminder: vi.fn(async () => null),
  sendWhatsAppMessage: vi.fn(async () => null),
}));

const insertedRows: Array<Record<string, unknown>> = [];

const appointmentRow = {
  id: "apt-1",
  business_id: "biz-1",
  customer_id: "cust-1",
  start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: "confirmed",
  customers: { id: "cust-1", name: "Test", phone: "+972500000000", language_preference: "he" },
  services: { name_he: "תספורת", name_ar: null, name_en: null },
  businesses: { name: "Studio" },
};

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: appointmentRow }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        insertedRows.push(row);
        return { error: null };
      },
    }),
  }),
}));

describe("sendAppointmentNotification — failure path", () => {
  beforeEach(() => {
    insertedRows.length = 0;
  });

  it("logs status='failed' with error when WhatsApp returns null", async () => {
    const { sendAppointmentNotification } = await import("../services/notifications.js");
    const result = await sendAppointmentNotification("apt-1", "reminder_60m");

    expect(result?.failed).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].status).toBe("failed");
    expect(insertedRows[0].error).toBe("WhatsApp send returned null (see [WhatsApp] log above for API error)");
    expect(insertedRows[0].whatsapp_message_id).toBeNull();
  });
});

describe("POST /api/internal/reminders/tick", () => {
  const SECRET = "test-secret-xyz";

  async function buildApp() {
    process.env.INTERNAL_SECRET = SECRET;
    const internalRouter = (await import("../routes/internal.js")).default;
    const app = express();
    app.use("/api/internal", internalRouter);
    return app;
  }

  it("rejects request with no header (401)", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/internal/reminders/tick");
    expect(res.status).toBe(401);
  });

  it("rejects request with wrong header (401)", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/internal/reminders/tick")
      .set("X-Internal-Secret", "wrong");
    expect(res.status).toBe(401);
  });

  it("returns 200 with counts when header matches", async () => {
    const notifications = await import("../services/notifications.js");
    const spy = vi
      .spyOn(notifications, "processReminders")
      .mockResolvedValue({ processed: 3, sent: 2, failed: 1 });

    const app = await buildApp();
    const res = await request(app)
      .post("/api/internal/reminders/tick")
      .set("X-Internal-Secret", SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ processed: 3, sent: 2, failed: 1 });
    spy.mockRestore();
  });
});
