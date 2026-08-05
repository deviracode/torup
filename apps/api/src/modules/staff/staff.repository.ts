import type {
  SupabaseClient,
  PostgrestFilterBuilder,
  PostgrestSingleResponse,
  PostgrestResponse,
} from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createStaffRepo(client: SupabaseClient<Database>) {
  const repo = {
    async findMembers(businessId: string) {
      return client
        .from("business_members")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");
    },
    async findServicesAll(memberIds: string[]) {
      return client.from("staff_services").select("staff_id, service_id").in("staff_id", memberIds);
    },
    async findTimeOffAll(memberIds: string[]) {
      return client.from("breaks").select("*").in("staff_id", memberIds).eq("label", "time_off");
    },
    async createMember(data: Record<string, unknown>) {
      return client
        .from("business_members")
        .insert(data as never)
        .select()
        .single();
    },
    async updateMember(memberId: string, businessId: string, data: Record<string, unknown>) {
      return client
        .from("business_members")
        .update(data as never)
        .eq("id", memberId)
        .eq("business_id", businessId)
        .select()
        .single();
    },
    async deleteMember(memberId: string, businessId: string) {
      return client
        .from("business_members")
        .delete()
        .eq("id", memberId)
        .eq("business_id", businessId);
    },
    async findServiceIds(memberId: string) {
      return client.from("staff_services").select("service_id").eq("staff_id", memberId);
    },
    async validateServiceIds(businessId: string, serviceIds: string[]) {
      return client
        .from("services")
        .select("id")
        .eq("business_id", businessId)
        .in("id", serviceIds);
    },
    async replaceServices(memberId: string, serviceIds: string[]) {
      await client.from("staff_services").delete().eq("staff_id", memberId);
      if (serviceIds.length === 0) return { error: null };
      return client
        .from("staff_services")
        .insert(serviceIds.map((sid) => ({ staff_id: memberId, service_id: sid })));
    },
    async findTimeOff(memberId: string) {
      return client
        .from("breaks")
        .select("*")
        .eq("staff_id", memberId)
        .eq("label", "time_off")
        .order("specific_date");
    },
    async insertTimeOff(rows: Record<string, unknown>[]) {
      return client
        .from("breaks")
        .insert(rows as never)
        .select();
    },
    async deleteTimeOff(breakIds: string[], memberId: string, businessId: string) {
      return client
        .from("breaks")
        .delete()
        .in("id", breakIds)
        .eq("staff_id", memberId)
        .eq("business_id", businessId);
    },
  };
  return repo;
}
