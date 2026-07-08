import { describe, it, expect, beforeEach } from "vitest";
import { buildRequestContext } from "../lib/request-context.js";

describe("buildRequestContext", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
  });

  it("marks super_admin role", () => {
    const ctx = buildRequestContext("jwt", { id: "u1", isSuperAdmin: true }, []);
    expect(ctx.role).toBe("super_admin");
  });

  it("derives business_owner from an owner membership", () => {
    const ctx = buildRequestContext("jwt", { id: "u1", isSuperAdmin: false }, [
      { businessId: "b1", role: "owner" },
    ]);
    expect(ctx.role).toBe("business_owner");
    expect(ctx.memberships).toHaveLength(1);
  });

  it("derives staff role and carries a user client", () => {
    const ctx = buildRequestContext("jwt", { id: "u1", isSuperAdmin: false }, [
      { businessId: "b1", role: "staff" },
    ]);
    expect(ctx.role).toBe("staff");
    expect(ctx.userClient).toBeDefined();
  });
});
