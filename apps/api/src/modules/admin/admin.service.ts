import { AppError } from "../../middleware/error-handler";
import { type createAdminRepo, generateSlug, generateTempPassword } from "./admin.repository";

type Repo = ReturnType<typeof createAdminRepo>;

export function createAdminService(repo: Repo) {
  return {
    async listBusinesses(filters?: { category?: string; status?: string; search?: string }) { const { data, error } = await repo.findBusinesses(filters); if (error) throw new AppError(500, error.message); return data; },
    async onboard(supabase: any, body: { name: string; category?: string; phone?: string; email?: string; plan_id?: string; owner_email?: string }) {
      const { name, category, phone, email, plan_id, owner_email } = body;
      const { data: biz, error: bErr } = await repo.createBusiness({ name, slug: generateSlug(name), category: category ?? null, phone: phone ?? null, email: email ?? null, default_language: "he" });
      if (bErr) throw new AppError(400, bErr.message); if (!biz) throw new AppError(500, "Failed to create business");
      let tempPw: string | null = null;
      if (owner_email) {
        let ownerId: string | null = null;
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => u.email === owner_email);
        tempPw = generateTempPassword();
        if (existing) { ownerId = existing.id; await supabase.auth.admin.updateUserById(existing.id, { password: tempPw }); }
        else { const { data: cr, error: cErr } = await supabase.auth.admin.createUser({ email: owner_email, password: tempPw, email_confirm: true, user_metadata: { role: "business_owner" } }); if (cErr) throw new AppError(400, cErr.message); if (cr?.user) ownerId = cr.user.id; }
        if (ownerId) await repo.createMember({ business_id: biz.id, user_id: ownerId, role: "owner" });
      }
      if (plan_id) await repo.createSubscription({ business_id: biz.id, plan_id, status: "trial", trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString() });
      await repo.createBookingRules({ business_id: biz.id });
      return { ...biz, temp_password: tempPw };
    },
    async editBusiness(businessId: string, data: Record<string, unknown>) { const { data: biz, error } = await repo.updateBusiness(businessId, data); if (error) throw new AppError(400, error.message); return biz; },
    async removeBusiness(businessId: string) { const { error } = await repo.deleteBusiness(businessId); if (error) throw new AppError(400, error.message); return { success: true }; },
    async analytics() {
      const [bR, aR, sR] = await Promise.all([repo.countBusinesses(), repo.countAppointments(), repo.countSubscriptions()]);
      return { total_businesses: bR.count || 0, total_appointments: aR.count || 0, active_subscriptions: (sR.data || []).filter((s: any) => s.status === "active" || s.status === "trial").length };
    },
    async impersonate(businessId: string, adminUserId: string) {
      const { data: biz, error } = await repo.findBusinessById(businessId); if (error || !biz) throw new AppError(404, "Business not found");
      await repo.insertLog({ business_id: businessId, type: "impersonation_start", channel: "system", template_id: "impersonation", status: "logged", customer_id: null, sent_at: new Date().toISOString(), error: `Admin ${adminUserId} started impersonating ${biz.name} (${businessId})` });
      return { impersonating: true, business: biz, admin_user_id: adminUserId };
    },
    async stopImpersonate(businessId: string | undefined, adminUserId: string) {
      if (businessId) await repo.insertLog({ business_id: businessId, type: "impersonation_stop", channel: "system", template_id: "impersonation", status: "logged", customer_id: null, sent_at: new Date().toISOString(), error: `Admin ${adminUserId} stopped impersonating ${businessId}` });
      return { impersonating: false };
    },
    async listPlans() { const { data, error } = await repo.findPlans(); if (error) throw new AppError(500, error.message); return data; },
    async addPlan(data: Record<string, unknown>) { const { data: p, error } = await repo.createPlan(data); if (error) throw new AppError(400, error.message); return p; },
    async editPlan(planId: string, data: Record<string, unknown>) { const { data: p, error } = await repo.updatePlan(planId, data); if (error) throw new AppError(400, error.message); return p; },
  };
}
