import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createServiceRepo(client: SupabaseClient<Database>) {
  return {
    async findAll(businessId: string): Promise<MultiResult> { return client.from("services").select("*").eq("business_id", businessId).eq("is_active", true).order("sort_order") as any; },
    async findCategories(businessId: string): Promise<MultiResult> { return client.from("service_categories").select("*").eq("business_id", businessId).order("sort_order") as any; },
    async create(data: Record<string, unknown>): Promise<SingleResult> { return client.from("services").insert(data).select().single() as any; },
    async update(serviceId: string, businessId: string, data: Record<string, unknown>): Promise<MultiResult> { return client.from("services").update(data).eq("id", serviceId).eq("business_id", businessId).select() as any; },
    async softDelete(serviceId: string, businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("services").update({ is_active: false }).eq("id", serviceId).eq("business_id", businessId) as any; },
  };
}
