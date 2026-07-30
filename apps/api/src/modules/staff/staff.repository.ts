import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createStaffRepo(client: SupabaseClient<Database>) {
  return {
    async findMembers(businessId: string): Promise<MultiResult> { return client.from("business_members").select("*").eq("business_id", businessId).order("created_at") as any; },
    async findServicesAll(memberIds: string[]): Promise<MultiResult> { return client.from("staff_services").select("staff_id, service_id").in("staff_id", memberIds) as any; },
    async findTimeOffAll(memberIds: string[]): Promise<MultiResult> { return client.from("breaks").select("*").in("staff_id", memberIds).eq("label", "time_off") as any; },
    async createMember(data: Record<string, unknown>): Promise<SingleResult> { return client.from("business_members").insert(data).select().single() as any; },
    async updateMember(memberId: string, businessId: string, data: Record<string, unknown>): Promise<SingleResult> { return client.from("business_members").update(data).eq("id", memberId).eq("business_id", businessId).select().single() as any; },
    async deleteMember(memberId: string, businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("business_members").delete().eq("id", memberId).eq("business_id", businessId) as any; },
    async findServiceIds(memberId: string): Promise<MultiResult> { return client.from("staff_services").select("service_id").eq("staff_id", memberId) as any; },
    async validateServiceIds(businessId: string, serviceIds: string[]): Promise<MultiResult> { return client.from("services").select("id").eq("business_id", businessId).in("id", serviceIds) as any; },
    async replaceServices(memberId: string, serviceIds: string[]): Promise<{ error: PostgrestError | null }> {
      await client.from("staff_services").delete().eq("staff_id", memberId);
      return serviceIds.length > 0 ? client.from("staff_services").insert(serviceIds.map(sid => ({ staff_id: memberId, service_id: sid }))) as any : { error: null };
    },
    async findTimeOff(memberId: string): Promise<MultiResult> { return client.from("breaks").select("*").eq("staff_id", memberId).eq("label", "time_off").order("specific_date") as any; },
    async insertTimeOff(rows: Record<string, unknown>[]): Promise<MultiResult> { return client.from("breaks").insert(rows).select() as any; },
    async deleteTimeOff(breakIds: string[], memberId: string, businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("breaks").delete().in("id", breakIds).eq("staff_id", memberId).eq("business_id", businessId) as any; },
  };
}
