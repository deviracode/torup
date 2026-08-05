import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createGcalRepo(client: SupabaseClient<Database>) {
  return {
    async upsertToken(data: Record<string, unknown>) { return client.from("google_calendar_tokens").upsert(data as never, { onConflict: "business_id" }); },
    async deleteTokens(businessId: string) { return client.from("google_calendar_tokens").delete().eq("business_id", businessId); },
    async deleteEvents(businessId: string) { return client.from("google_calendar_events").delete().eq("business_id", businessId); },
    async findTokenStatus(businessId: string) { return client.from("google_calendar_tokens").select("google_calendar_id, sync_enabled, push_enabled, token_expires_at, updated_at").eq("business_id", businessId).single(); },
    async updateTokenSettings(businessId: string, data: Record<string, unknown>) { return client.from("google_calendar_tokens").update(data as never).eq("business_id", businessId); },
    async findEvents(businessId: string, date: string) { return client.from("google_calendar_events").select("google_event_id, summary, start_time, end_time").eq("business_id", businessId).gte("start_time", `${date}T00:00:00+03:00`).lte("start_time", `${date}T23:59:59+03:00`).order("start_time"); },
  };
}
