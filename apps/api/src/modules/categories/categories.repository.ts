import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createCategoryRepo(client: SupabaseClient<Database>) {
  return {
    async findAll(businessId: string) {
      return client.from("service_categories").select("*").eq("business_id", businessId).order("sort_order");
    },
    async create(data: Record<string, unknown>) {
      return client.from("service_categories").insert(data as never).select().single();
    },
    async update(categoryId: string, businessId: string, data: Record<string, unknown>) {
      return client.from("service_categories").update(data as never).eq("id", categoryId).eq("business_id", businessId);
    },
    async remove(categoryId: string, businessId: string) {
      return client.from("service_categories").delete().eq("id", categoryId).eq("business_id", businessId);
    },
  };
}
