import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUserClient } from "../client.js";

describe("createUserClient", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("attaches the access token as an Authorization header", () => {
    const client = createUserClient("jwt-123");
    // supabase-js stores global headers on the rest client
    const headers = (client as unknown as {
      rest: { headers: Headers };
    }).rest.headers;
    expect(headers.get("authorization")).toBe("Bearer jwt-123");
  });

  it("throws when access token is empty", () => {
    expect(() => createUserClient("")).toThrow();
  });
});
