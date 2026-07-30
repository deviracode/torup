import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createBusinessRepo(client: SupabaseClient<Database>) {
  return {
    async findById(businessId: string): Promise<SingleResult> {
      return client.from("businesses").select("*").eq("id", businessId).single() as any;
    },
    async findBySlugOrId(slugOrId: string): Promise<SingleResult> {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      return (isUUID ? client.from("businesses").select("*").eq("id", slugOrId) : client.from("businesses").select("*").eq("slug", slugOrId).eq("is_active", true)).single() as any;
    },
    async update(businessId: string, data: Record<string, unknown>): Promise<SingleResult> {
      return client.from("businesses").update(data).eq("id", businessId).select().single() as any;
    },
  };
}
