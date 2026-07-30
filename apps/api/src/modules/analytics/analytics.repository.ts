import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };

export function createAnalyticsRepo(client: SupabaseClient<Database>) {
  return {
    async findAppointments(businessId: string, since: string): Promise<MultiResult & { count: number | null }> {
      return client.from("appointments").select("id, status, start_time, service_id, created_via", { count: "exact" }).eq("business_id", businessId).gte("start_time", since) as any;
    },
    async findNoShows(businessId: string, since: string): Promise<MultiResult & { count: number | null }> {
      return client.from("appointments").select("id", { count: "exact" }).eq("business_id", businessId).eq("status", "no_show").gte("start_time", since) as any;
    },
    async findServices(businessId: string): Promise<MultiResult> {
      return client.from("services").select("id, name_he, price").eq("business_id", businessId).eq("is_active", true) as any;
    },
  };
}
