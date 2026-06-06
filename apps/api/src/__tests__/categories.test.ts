import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase.js", () => ({
  createServiceClient: () => ({
    from: (_table: string) => ({
      select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => ({ data: { id: "cat-1", name_he: "תסרוקות", name_ar: null, name_en: null, sort_order: 0, business_id: "biz-1" }, error: null }) }) }),
      update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: { id: "cat-1", name_he: "תסרוקות חדש", sort_order: 1, business_id: "biz-1" }, error: null }) }) }) }) }),
      delete: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }),
    }),
  }),
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireBusinessAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: (..._roles: string[]) => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/params.js", () => ({
  getBusinessId: () => "biz-1",
  getParam: (_req: unknown, key: string) => key === "categoryId" ? "cat-1" : "",
}));

import express from "express";
import request from "supertest";
import categoriesRouter from "../routes/categories.js";

const app = express();
app.use(express.json());
app.use("/", categoriesRouter);

describe("Categories API", () => {
  it("GET / returns list", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST / creates category", async () => {
    const res = await request(app).post("/").send({ name_he: "תסרוקות" });
    expect(res.status).toBe(201);
    expect(res.body.name_he).toBe("תסרוקות");
  });

  it("PATCH /:categoryId updates category", async () => {
    const res = await request(app).patch("/cat-1").send({ name_he: "תסרוקות חדש" });
    expect(res.status).toBe(200);
    expect(res.body.name_he).toBe("תסרוקות חדש");
  });

  it("DELETE /:categoryId returns 204", async () => {
    const res = await request(app).delete("/cat-1");
    expect(res.status).toBe(204);
  });
});
