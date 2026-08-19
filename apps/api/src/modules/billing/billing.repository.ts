import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createBillingRepo(client: SupabaseClient<Database>) {
  return {
    async findPlan(planId: string) {
      return client.from("plans").select("name, monthly_price").eq("id", planId).single();
    },
    async findBusiness(businessId: string) {
      return client.from("businesses").select("name, email").eq("id", businessId).single();
    },
    async findSubscription(businessId: string) {
      return client
        .from("subscriptions")
        .select(
          "*, plans(name, monthly_price, yearly_price, max_staff, max_appointments_monthly, features)"
        )
        .eq("business_id", businessId)
        .single();
    },
  };
}
