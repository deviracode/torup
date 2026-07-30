import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createBillingRepo(client: SupabaseClient<Database>) {
  return {
    async findPlan(planId: string): Promise<SingleResult> { return client.from("plans").select("name, monthly_price").eq("id", planId).single() as any; },
    async findBusiness(businessId: string): Promise<SingleResult> { return client.from("businesses").select("name, email").eq("id", businessId).single() as any; },
    async findSubscription(businessId: string): Promise<SingleResult> { return client.from("subscriptions").select("*, plans(name, monthly_price, yearly_price, max_staff, max_appointments_monthly, features)").eq("business_id", businessId).single() as any; },
  };
}
