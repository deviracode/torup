import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createCategoryRepo(client: SupabaseClient<Database>) {
  return {
    async findAll(businessId: string): Promise<MultiResult> {
      return client.from("service_categories").select("*").eq("business_id", businessId).order("sort_order") as any;
    },
    async create(data: Record<string, unknown>): Promise<SingleResult> {
      return client.from("service_categories").insert(data).select().single() as any;
    },
    async update(categoryId: string, businessId: string, data: Record<string, unknown>): Promise<{ error: PostgrestError | null }> {
      return client.from("service_categories").update(data).eq("id", categoryId).eq("business_id", businessId) as any;
    },
    async remove(categoryId: string, businessId: string): Promise<{ error: PostgrestError | null }> {
      return client.from("service_categories").delete().eq("id", categoryId).eq("business_id", businessId) as any;
    },
  };
}
