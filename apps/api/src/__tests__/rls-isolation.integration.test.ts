import { describe, it, expect } from "vitest";
import { createUserClient } from "@torup/db";

const HAS_DB =
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_ANON_KEY &&
  !!process.env.RLS_TEST_JWT_B1 &&
  !!process.env.RLS_TEST_BUSINESS_B2;

describe.skipIf(!HAS_DB)("RLS tenant isolation", () => {
  it("a member of B1 cannot read B2 appointments even with explicit filter", async () => {
    const clientB1 = createUserClient(process.env.RLS_TEST_JWT_B1!);
    const { data, error } = await clientB1
      .from("appointments")
      .select("id")
      .eq("business_id", process.env.RLS_TEST_BUSINESS_B2!);
    // RLS yields zero rows (not an error) for the other tenant
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("a member of B1 cannot insert an appointment into B2", async () => {
    const clientB1 = createUserClient(process.env.RLS_TEST_JWT_B1!);
    const { error } = await clientB1.from("appointments").insert({
      business_id: process.env.RLS_TEST_BUSINESS_B2!,
      service_id: "00000000-0000-0000-0000-000000000000",
      customer_id: "00000000-0000-0000-0000-000000000000",
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(error).not.toBeNull(); // RLS policy blocks the write
  });
});
