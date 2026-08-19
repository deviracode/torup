import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@torup/db";

export function createCustomerRepo(client: SupabaseClient<Database>) {
  return {
    async findCustomerIdsForBusiness(businessId: string) {
      return client.from("appointments").select("customer_id").eq("business_id", businessId);
    },
    async findByIds(ids: string[], search?: string) {
      let q = client.from("customers").select("*").in("id", ids);
      if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      return q.order("name");
    },
    async findOrCreateViaRpc(input: { phone: string; name?: string | null; language_preference?: string }) {
      // Scoped SECURITY DEFINER RPC — the anon key can reach only this single
      // row (find-or-create by phone), never the whole customers table.
      return client.rpc("find_or_create_customer", {
        p_phone: input.phone,
        p_name: input.name || undefined,
        p_language: (input.language_preference ?? "he") as Enums<"supported_language">,
      });
    },
    async update(customerId: string, data: Record<string, unknown>) {
      return client
        .from("customers")
        .update(data as never)
        .eq("id", customerId)
        .select()
        .single();
    },
  };
}
