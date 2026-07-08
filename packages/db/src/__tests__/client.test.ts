import { describe, it, expect, beforeEach } from "vitest";
import { createUserClient } from "../client.js";

describe("createUserClient", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
  });

  it("attaches the access token as an Authorization header", () => {
    const client = createUserClient("jwt-123");
    // supabase-js stores global headers on the rest client
    const headers = (client as unknown as {
      rest: { headers: Record<string, string> };
    }).rest.headers;
    // Headers API normalizes keys to lowercase, but also provides .get() method
    const authHeader = (headers as any).get?.("Authorization") || headers.Authorization;
    expect(authHeader).toBe("Bearer jwt-123");
  });

  it("throws when access token is empty", () => {
    expect(() => createUserClient("")).toThrow();
  });
});
