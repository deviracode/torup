import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createAnalyticsRepo(client: SupabaseClient<Database>) {
  return {
    async findAppointments(businessId: string, since: string) {
      return client
        .from("appointments")
        .select("id, status, start_time, service_id, created_via", { count: "exact" })
        .eq("business_id", businessId)
        .gte("start_time", since);
    },
    async findNoShows(businessId: string, since: string) {
      return client
        .from("appointments")
        .select("id", { count: "exact" })
        .eq("business_id", businessId)
        .eq("status", "no_show")
        .gte("start_time", since);
    },
    async findServices(businessId: string) {
      return client
        .from("services")
        .select("id, name_he, price")
        .eq("business_id", businessId)
        .eq("is_active", true);
    },
  };
}
