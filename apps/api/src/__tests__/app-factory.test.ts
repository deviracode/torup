import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../services/notifications", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../services/notifications")>();
  return { ...mod, startReminderScheduler: vi.fn(), stopReminderScheduler: vi.fn() };
});

vi.mock("../services/google-calendar", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../services/google-calendar")>();
  return { ...mod, startGCalSyncScheduler: vi.fn(), stopGCalSyncScheduler: vi.fn() };
});

describe("createApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to public-only: no internal routes, no schedulers", async () => {
    const { createApp } = await import("../app");
    const app = createApp({});

    const res = await request(app).post("/api/internal/reminders/tick");
    expect(res.status).toBe(404);

    const { startReminderScheduler } = await import("../services/notifications");
    const { startGCalSyncScheduler } = await import("../services/google-calendar");
    expect(startReminderScheduler).not.toHaveBeenCalled();
    expect(startGCalSyncScheduler).not.toHaveBeenCalled();
  });

  it("mounts internal routes when mountInternal is true (secret still required)", async () => {
    const { createApp } = await import("../app");
    const app = createApp({ mountInternal: true });

    const res = await request(app).post("/api/internal/reminders/tick");
    expect(res.status).toBe(401);
  });

  it("starts schedulers when startSchedulers is true", async () => {
    const { createApp } = await import("../app");
    createApp({ startSchedulers: true });

    const { startReminderScheduler } = await import("../services/notifications");
    const { startGCalSyncScheduler } = await import("../services/google-calendar");
    expect(startReminderScheduler).toHaveBeenCalledTimes(1);
    expect(startGCalSyncScheduler).toHaveBeenCalledTimes(1);
  });

  it("always serves the health check", async () => {
    const { createApp } = await import("../app");
    const app = createApp({});

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});
