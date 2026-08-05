import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

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
    async findByPhone(phone: string) {
      return client.from("customers").select("*").eq("phone", phone).single();
    },
    async create(data: Record<string, unknown>) {
      return client.from("customers").insert(data as never).select().single();
    },
    async update(customerId: string, data: Record<string, unknown>) {
      return client.from("customers").update(data as never).eq("id", customerId).select().single();
    },
  };
}
