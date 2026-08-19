import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createConfigRepo(client: SupabaseClient<Database>) {
  return {
    async findWorkingHours(businessId: string) {
      return client
        .from("working_hours")
        .select("*")
        .eq("business_id", businessId)
        .order("day_of_week");
    },
    async deleteWorkingHours(businessId: string) {
      return client
        .from("working_hours")
        .delete()
        .eq("business_id", businessId)
        .is("staff_id", null);
    },
    async insertWorkingHours(rows: Record<string, unknown>[]) {
      return client
        .from("working_hours")
        .insert(rows as never)
        .select();
    },
    async findBreaks(businessId: string) {
      return client.from("breaks").select("*").eq("business_id", businessId).order("created_at");
    },
    async createBreak(data: Record<string, unknown>) {
      return client
        .from("breaks")
        .insert(data as never)
        .select()
        .single();
    },
    async deleteBreak(breakId: string, businessId: string) {
      return client.from("breaks").delete().eq("id", breakId).eq("business_id", businessId);
    },
    async findBookingRules(businessId: string) {
      return client.from("booking_rules").select("*").eq("business_id", businessId).single();
    },
    async upsertBookingRules(data: Record<string, unknown>) {
      return client
        .from("booking_rules")
        .upsert(data as never)
        .select()
        .single();
    },
    async findReminderSettings(businessId: string) {
      return client
        .from("reminder_settings")
        .select("*")
        .eq("business_id", businessId)
        .order("minutes_before");
    },
    async createReminderSetting(data: Record<string, unknown>) {
      return client
        .from("reminder_settings")
        .insert(data as never)
        .select()
        .single();
    },
    async updateReminderSetting(
      reminderId: string,
      businessId: string,
      data: Record<string, unknown>
    ) {
      return client
        .from("reminder_settings")
        .update(data as never)
        .eq("id", reminderId)
        .eq("business_id", businessId)
        .select()
        .single();
    },
    async deleteReminderSetting(reminderId: string, businessId: string) {
      return client
        .from("reminder_settings")
        .delete()
        .eq("id", reminderId)
        .eq("business_id", businessId);
    },
  };
}
