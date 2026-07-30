import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createAdminRepo(client: SupabaseClient<Database>) {
  return {
    async findBusinesses(filters?: { category?: string; status?: string; search?: string }): Promise<MultiResult> {
      let q = client.from("businesses").select("*, subscriptions(status, plan_id, plans(name))").order("created_at", { ascending: false });
      if (filters?.category) q = q.eq("category", filters.category);
      if (filters?.status === "active") q = q.eq("is_active", true);
      else if (filters?.status === "inactive") q = q.eq("is_active", false);
      if (filters?.search) q = q.or(`name.ilike.%${filters.search}%,slug.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      return q as any;
    },
    async findBusinessById(businessId: string): Promise<SingleResult> { return client.from("businesses").select("id, name, slug").eq("id", businessId).single() as any; },
    async createBusiness(data: Record<string, unknown>): Promise<SingleResult> { return client.from("businesses").insert(data).select().single() as any; },
    async updateBusiness(businessId: string, data: Record<string, unknown>): Promise<SingleResult> { return client.from("businesses").update(data).eq("id", businessId).select().single() as any; },
    async deleteBusiness(businessId: string): Promise<{ error: PostgrestError | null }> { return client.from("businesses").delete().eq("id", businessId) as any; },
    async countBusinesses(): Promise<MultiResult & { count: number | null }> { return client.from("businesses").select("id, created_at, is_active", { count: "exact" }) as any; },
    async countAppointments(): Promise<MultiResult & { count: number | null }> { return client.from("appointments").select("id, created_at, status", { count: "exact" }) as any; },
    async countSubscriptions(): Promise<MultiResult & { count: number | null }> { return client.from("subscriptions").select("id, status", { count: "exact" }) as any; },
    async createMember(data: Record<string, unknown>): Promise<SingleResult> { return client.from("business_members").insert(data).select().single() as any; },
    async createSubscription(data: Record<string, unknown>): Promise<{ error: PostgrestError | null }> { return client.from("subscriptions").insert(data) as any; },
    async createBookingRules(data: Record<string, unknown>): Promise<{ error: PostgrestError | null }> { return client.from("booking_rules").insert(data) as any; },
    async insertLog(data: Record<string, unknown>): Promise<{ error: PostgrestError | null }> { return client.from("notifications_log").insert(data) as any; },
    async findPlans(): Promise<MultiResult> { return client.from("plans").select("*").order("monthly_price") as any; },
    async createPlan(data: Record<string, unknown>): Promise<SingleResult> { return client.from("plans").insert(data).select().single() as any; },
    async updatePlan(planId: string, data: Record<string, unknown>): Promise<SingleResult> { return client.from("plans").update(data).eq("id", planId).select().single() as any; },
  };
}

export function generateSlug(name: string): string { return name.toLowerCase().replace(/[^a-z0-9\u0590-\u05ff\u0600-\u06ff]+/g, "-").replace(/^-|-$/g, ""); }
export function generateTempPassword(): string { return Math.random().toString(36).slice(-10) + "A1!"; }
