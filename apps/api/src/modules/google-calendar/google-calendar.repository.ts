import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };
type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };

export function createGcalRepo(client: SupabaseClient<Database>) {
  return {
    async upsertToken(data: Record<string, unknown>): Promise<{ error: PostgrestError | null }> { return client.from("google_calendar_tokens").upsert(data, { onConflict: "business_id" }) as any; },
    async deleteTokens(businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("google_calendar_tokens").delete().eq("business_id", businessId) as any; },
    async deleteEvents(businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("google_calendar_events").delete().eq("business_id", businessId) as any; },
    async findTokenStatus(businessId: string): Promise<SingleResult> { return client.from("google_calendar_tokens").select("google_calendar_id, sync_enabled, push_enabled, token_expires_at, updated_at").eq("business_id", businessId).single() as any; },
    async updateTokenSettings(businessId: string, data: Record<string, unknown>): Promise<{ error: PostgrestError | null }> { return client.from("google_calendar_tokens").update(data).eq("business_id", businessId) as any; },
    async findEvents(businessId: string, date: string): Promise<MultiResult> { return client.from("google_calendar_events").select("google_event_id, summary, start_time, end_time").eq("business_id", businessId).gte("start_time", `${date}T00:00:00+03:00`).lte("start_time", `${date}T23:59:59+03:00`).order("start_time") as any; },
  };
}
