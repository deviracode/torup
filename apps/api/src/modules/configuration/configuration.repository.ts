import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createConfigRepo(client: SupabaseClient<Database>) {
  return {
    async findWorkingHours(businessId: string): Promise<MultiResult> { return client.from("working_hours").select("*").eq("business_id", businessId).order("day_of_week") as any; },
    async deleteWorkingHours(businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("working_hours").delete().eq("business_id", businessId).is("staff_id", null) as any; },
    async insertWorkingHours(rows: Record<string, unknown>[]): Promise<MultiResult> { return client.from("working_hours").insert(rows).select() as any; },
    async findBreaks(businessId: string): Promise<MultiResult> { return client.from("breaks").select("*").eq("business_id", businessId).order("created_at") as any; },
    async createBreak(data: Record<string, unknown>): Promise<SingleResult> { return client.from("breaks").insert(data).select().single() as any; },
    async deleteBreak(breakId: string, businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("breaks").delete().eq("id", breakId).eq("business_id", businessId) as any; },
    async findBookingRules(businessId: string): Promise<SingleResult> { return client.from("booking_rules").select("*").eq("business_id", businessId).single() as any; },
    async upsertBookingRules(data: Record<string, unknown>): Promise<SingleResult> { return client.from("booking_rules").upsert(data).select().single() as any; },
    async findReminderSettings(businessId: string): Promise<MultiResult> { return client.from("reminder_settings").select("*").eq("business_id", businessId).order("minutes_before") as any; },
    async createReminderSetting(data: Record<string, unknown>): Promise<SingleResult> { return client.from("reminder_settings").insert(data).select().single() as any; },
    async updateReminderSetting(reminderId: string, businessId: string, data: Record<string, unknown>): Promise<SingleResult> { return client.from("reminder_settings").update(data).eq("id", reminderId).eq("business_id", businessId).select().single() as any; },
    async deleteReminderSetting(reminderId: string, businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("reminder_settings").delete().eq("id", reminderId).eq("business_id", businessId) as any; },
  };
}
