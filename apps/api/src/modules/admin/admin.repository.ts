import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createAdminRepo(client: SupabaseClient<Database>) {
  return {
    async findBusinesses(filters?: { category?: string; status?: string; search?: string }) {
      let q = client
        .from("businesses")
        .select("*, subscriptions(status, plan_id, plans(name))")
        .order("created_at", { ascending: false });
      if (filters?.category) q = q.eq("category", filters.category);
      if (filters?.status === "active") q = q.eq("is_active", true);
      else if (filters?.status === "inactive") q = q.eq("is_active", false);
      if (filters?.search)
        q = q.or(
          `name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        );
      return q;
    },
    async findBusinessById(businessId: string) {
      return client.from("businesses").select("id, name, slug").eq("id", businessId).single();
    },
    async createBusiness(data: Record<string, unknown>) {
      return client
        .from("businesses")
        .insert(data as never)
        .select()
        .single();
    },
    async updateBusiness(businessId: string, data: Record<string, unknown>) {
      return client
        .from("businesses")
        .update(data as never)
        .eq("id", businessId)
        .select()
        .single();
    },
    async deleteBusiness(businessId: string) {
      return client.from("businesses").delete().eq("id", businessId);
    },
    async countBusinesses() {
      return client.from("businesses").select("id, created_at, is_active", { count: "exact" });
    },
    async countAppointments() {
      return client.from("appointments").select("id, created_at, status", { count: "exact" });
    },
    async countSubscriptions() {
      return client.from("subscriptions").select("id, status", { count: "exact" });
    },
    async createMember(data: Record<string, unknown>) {
      return client
        .from("business_members")
        .insert(data as never)
        .select()
        .single();
    },
    async createSubscription(data: Record<string, unknown>) {
      return client.from("subscriptions").insert(data as never);
    },
    async createBookingRules(data: Record<string, unknown>) {
      return client.from("booking_rules").insert(data as never);
    },
    async insertLog(data: Record<string, unknown>) {
      return client.from("notifications_log").insert(data as never);
    },
    async findPlans() {
      return client.from("plans").select("*").order("monthly_price");
    },
    async createPlan(data: Record<string, unknown>) {
      return client
        .from("plans")
        .insert(data as never)
        .select()
        .single();
    },
    async updatePlan(planId: string, data: Record<string, unknown>) {
      return client
        .from("plans")
        .update(data as never)
        .eq("id", planId)
        .select()
        .single();
    },
  };
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff\u0600-\u06ff]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function generateTempPassword(): string {
  return Math.random().toString(36).slice(-10) + "A1!";
}
