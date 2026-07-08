// apps/api/src/__tests__/auth-middleware.test.ts
import { describe, it, expect, vi } from "vitest";
import type { Response, NextFunction } from "express";
import { requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth.js";

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("requireBusinessAccess", () => {
  it("allows a member of the URL business (even with multiple memberships)", () => {
    const req = {
      params: { businessId: "b2" },
      ctx: {
        role: "business_owner",
        memberships: [
          { businessId: "b1", role: "owner" },
          { businessId: "b2", role: "staff" },
        ],
      },
    } as unknown as AuthenticatedRequest;
    const next = vi.fn() as unknown as NextFunction;
    requireBusinessAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("403s when user is not a member of the URL business", () => {
    const req = {
      params: { businessId: "b9" },
      ctx: { role: "staff", memberships: [{ businessId: "b1", role: "staff" }] },
    } as unknown as AuthenticatedRequest;
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    requireBusinessAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("always allows super_admin", () => {
    const req = {
      params: { businessId: "bX" },
      ctx: { role: "super_admin", memberships: [] },
    } as unknown as AuthenticatedRequest;
    const next = vi.fn() as unknown as NextFunction;
    requireBusinessAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
