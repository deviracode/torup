import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createServiceRepo(client: SupabaseClient<Database>) {
  return {
    async findAll(businessId: string) { return client.from("services").select("*").eq("business_id", businessId).eq("is_active", true).order("sort_order"); },
    async findCategories(businessId: string) { return client.from("service_categories").select("*").eq("business_id", businessId).order("sort_order"); },
    async create(data: Record<string, unknown>) { return client.from("services").insert(data as never).select().single(); },
    async update(serviceId: string, businessId: string, data: Record<string, unknown>) { return client.from("services").update(data as never).eq("id", serviceId).eq("business_id", businessId).select(); },
    async softDelete(serviceId: string, businessId: string) { return client.from("services").update({ is_active: false }).eq("id", serviceId).eq("business_id", businessId); },
  };
}
