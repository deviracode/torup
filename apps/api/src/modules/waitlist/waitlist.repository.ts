import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createWaitlistRepo(client: SupabaseClient<Database>) {
  return {
    async findAll(businessId: string): Promise<MultiResult> {
      return client
        .from("waitlist")
        .select("*, services(name_he, name_ar, name_en), customers(name, phone)")
        .eq("business_id", businessId)
        .eq("status", "waiting")
        .order("created_at") as any;
    },
    async create(data: Record<string, unknown>): Promise<SingleResult> {
      return client.from("waitlist").insert(data).select().single() as any;
    },
  };
}
