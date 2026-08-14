import { describe, it, expect, vi } from "vitest";
import type { AuthenticatedRequest } from "../middleware/auth";

vi.mock("../middleware/auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../middleware/auth")>();
  return {
    ...mod,
    requireAuth: (
      req: AuthenticatedRequest,
      _res: unknown,
      next: () => void
    ) => {
      req.ctx = {
        userId: "u1",
        userEmail: "owner@example.com",
        role: "business_owner",
        memberships: [{ businessId: "business-A", role: "owner" }],
        userClient: {} as never,
      };
      next();
    },
  };
});

function makeUserStub() {
  return {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  };
}

vi.mock("../lib/params", () => ({
  getBusinessId: (req: { params: Record<string, string> }) => req.params.businessId,
  getUserClient: () => makeUserStub(),
}));

import express from "express";
import request from "supertest";
import notificationsRouter from "../routes/notifications";

const app = express();
app.use(express.json());
app.use("/api/businesses/:businessId/notifications", notificationsRouter);

describe("Notifications API", () => {
  it("403s when the user is not a member of the business in the URL", async () => {
    const res = await request(app)
      .get("/api/businesses/business-B/notifications")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(403);
  });

  it("allows a member of the business in the URL", async () => {
    const res = await request(app)
      .get("/api/businesses/business-A/notifications")
      .set("Authorization", "Bearer fake-token");
    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
  });
});
