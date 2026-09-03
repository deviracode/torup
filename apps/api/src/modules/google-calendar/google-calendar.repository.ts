import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

// Re-derives the Israel offset per-date instead of hardcoding it, matching
// the same pattern already used correctly in appointment.repository.ts and
// availability.service.ts. A hardcoded "+03:00" (IDT, summer clock) is
// silently wrong for half the year — Israel falls back to standard time
// (+02:00) every autumn.
function getILOffset(d: string): string {
  const ref = new Date(`${d}T12:00:00Z`);
  const utcH = ref.getUTCHours();
  const ilH = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      hour: "numeric",
      hour12: false,
    }).format(ref)
  );
  let diff = ilH - utcH;
  if (diff < 0) diff += 24;
  if (diff > 12) diff -= 24;
  return `+${String(diff).padStart(2, "0")}:00`;
}

export function createGcalRepo(client: SupabaseClient<Database>) {
  return {
    async upsertToken(data: Record<string, unknown>) {
      return client
        .from("google_calendar_tokens")
        .upsert(data as never, { onConflict: "business_id" });
    },
    async deleteTokens(businessId: string) {
      return client.from("google_calendar_tokens").delete().eq("business_id", businessId);
    },
    async deleteEvents(businessId: string) {
      return client.from("google_calendar_events").delete().eq("business_id", businessId);
    },
    async findTokenStatus(businessId: string) {
      return client
        .from("google_calendar_tokens")
        .select("google_calendar_id, sync_enabled, push_enabled, token_expires_at, updated_at")
        .eq("business_id", businessId)
        .single();
    },
    async updateTokenSettings(businessId: string, data: Record<string, unknown>) {
      return client
        .from("google_calendar_tokens")
        .update(data as never)
        .eq("business_id", businessId);
    },
    async findEvents(businessId: string, date: string) {
      const offset = getILOffset(date);
      return client
        .from("google_calendar_events")
        .select("google_event_id, summary, start_time, end_time")
        .eq("business_id", businessId)
        .gte("start_time", `${date}T00:00:00${offset}`)
        .lte("start_time", `${date}T23:59:59${offset}`)
        .order("start_time");
    },
  };
}
