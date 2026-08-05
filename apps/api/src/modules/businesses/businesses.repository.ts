import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createBusinessRepo(client: SupabaseClient<Database>) {
  return {
    async findById(businessId: string) {
      return client.from("businesses").select("*").eq("id", businessId).single();
    },
    async findBySlugOrId(slugOrId: string) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      return (isUUID ? client.from("businesses").select("*").eq("id", slugOrId) : client.from("businesses").select("*").eq("slug", slugOrId).eq("is_active", true)).single();
    },
    async update(businessId: string, data: Record<string, unknown>) {
      return client.from("businesses").update(data as never).eq("id", businessId).select().single();
    },
  };
}
