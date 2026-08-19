import { describe, it, expect, beforeAll } from "vitest";
import { createUserClient } from "@torup/db";

const HAS_DB =
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_ANON_KEY &&
  !!process.env.RLS_TEST_JWT_B1 &&
  !!process.env.RLS_TEST_JWT_B2 &&
  !!process.env.RLS_TEST_BUSINESS_B2;

describe.skipIf(!HAS_DB)("RLS tenant isolation", () => {
  beforeAll(async () => {
    // Positive control: verify B2 actually has appointments before testing isolation.
    // If B2 has no appointments, a "zero rows" result for the B1 client proves nothing.
    const clientB2 = createUserClient(process.env.RLS_TEST_JWT_B2!);
    const { data, error } = await clientB2
      .from("appointments")
      .select("id")
      .eq("business_id", process.env.RLS_TEST_BUSINESS_B2!);

    if (error) {
      throw new Error(
        `precondition: B2 client failed to read its own appointments: ${error.message}`,
      );
    }

    if (!data || data.length === 0) {
      throw new Error(
        "precondition: B2 must have >=1 appointment; seed data missing",
      );
    }
  });

  it("a member of B1 cannot read B2 appointments even with explicit filter", async () => {
    const clientB1 = createUserClient(process.env.RLS_TEST_JWT_B1!);
    const { data, error } = await clientB1
      .from("appointments")
      .select("id")
      .eq("business_id", process.env.RLS_TEST_BUSINESS_B2!);
    // RLS yields zero rows (not an error) for the other tenant.
    // The beforeAll positive control proves those rows exist for B2,
    // so zero rows here means RLS filtered them — not that B2 was empty.
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
    // Must be a specific RLS / authorization denial, not just any error.
    // PostgREST surfaces Postgres 42501 (insufficient_privilege) as code "42501"
    // or wraps it as "PGRST301" — either confirms RLS blocked the write, not a FK race.
    expect(error).not.toBeNull();
    expect(["42501", "PGRST301"]).toContain(error!.code);
  });
});
