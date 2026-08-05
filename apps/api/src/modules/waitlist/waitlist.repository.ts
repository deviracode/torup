import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createWaitlistRepo(client: SupabaseClient<Database>) {
  return {
    async findAll(businessId: string) {
      return client
        .from("waitlist")
        .select("*, services(name_he, name_ar, name_en), customers(name, phone)")
        .eq("business_id", businessId)
        .eq("status", "waiting")
        .order("created_at");
    },
    async create(data: Record<string, unknown>) {
      return client.from("waitlist").insert(data as never).select().single();
    },
  };
}
