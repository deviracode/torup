import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createCustomerRepo(client: SupabaseClient<Database>) {
  return {
    async findCustomerIdsForBusiness(businessId: string): Promise<MultiResult> {
      return client.from("appointments").select("customer_id").eq("business_id", businessId) as any;
    },
    async findByIds(ids: string[], search?: string): Promise<MultiResult> {
      let q = client.from("customers").select("*").in("id", ids);
      if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      return q.order("name") as any;
    },
    async findByPhone(phone: string): Promise<SingleResult> {
      return client.from("customers").select("*").eq("phone", phone).single() as any;
    },
    async create(data: Record<string, unknown>): Promise<SingleResult> {
      return client.from("customers").insert(data).select().single() as any;
    },
    async update(customerId: string, data: Record<string, unknown>): Promise<SingleResult> {
      return client.from("customers").update(data).eq("id", customerId).select().single() as any;
    },
  };
}
