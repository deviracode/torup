import { AppError } from "../../middleware/error-handler";
import { type createAdminRepo, generateSlug, generateTempPassword } from "./admin.repository";

type Repo = ReturnType<typeof createAdminRepo>;

async function fetchAllUsers(supabase: any) {
  const users: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new AppError(500, error.message);
    users.push(...(data?.users ?? []));
    if (!data?.users || data.users.length < 1000) break;
    page += 1;
  }
  return users;
}

export function createAdminService(repo: Repo) {
  return {
    async listBusinesses(
      supabase: any,
      filters?: { category?: string; status?: string; search?: string }
    ) {
      const { data, error } = await repo.findBusinesses(filters);
      if (error) throw new AppError(500, error.message);
      const businesses = data ?? [];
      if (businesses.length === 0) return businesses;
      const { data: owners } = await repo.findOwners(businesses.map((b: any) => b.id as string));
      const ownerIdByBusiness = new Map(
        (owners ?? []).map((o: any) => [o.business_id as string, o.user_id as string])
      );
      const ownerIds = [...new Set(ownerIdByBusiness.values())];
      let emailByUser = new Map<string, string>();
      if (ownerIds.length > 0) {
        const users = await fetchAllUsers(supabase);
        emailByUser = new Map(users.map((u: any) => [u.id as string, u.email as string]));
      }
      return businesses.map((b: any) => ({
        ...b,
        owner_email: emailByUser.get(ownerIdByBusiness.get(b.id) ?? "") ?? null,
      }));
    },
    async onboard(
      supabase: any,
      body: {
        name: string;
        category?: string;
        phone?: string;
        email?: string;
        plan_id?: string;
        owner_email?: string;
      }
    ) {
      const { name, category, phone, email, plan_id, owner_email } = body;
      const { data: biz, error: bErr } = await repo.createBusiness({
        name,
        slug: generateSlug(name),
        category: category ?? null,
        phone: phone ?? null,
        email: email ?? null,
        default_language: "he",
      });
      if (bErr) throw new AppError(400, bErr.message);
      if (!biz) throw new AppError(500, "Failed to create business");
      let tempPw: string | null = null;
      let userExisted = false;
      if (owner_email) {
        let ownerId: string | null = null;
        const users = await fetchAllUsers(supabase);
        const existing = users.find((u: any) => u.email === owner_email);
        if (existing) {
          ownerId = existing.id;
          userExisted = true;
        } else {
          tempPw = generateTempPassword();
          const { data: cr, error: cErr } = await supabase.auth.admin.createUser({
            email: owner_email,
            password: tempPw,
            email_confirm: true,
            user_metadata: { role: "business_owner" },
          });
          if (cErr) throw new AppError(400, cErr.message);
          if (cr?.user) ownerId = cr.user.id;
        }
        if (ownerId)
          await repo.createMember({ business_id: biz.id, user_id: ownerId, role: "owner" });
      }
      if (plan_id)
        await repo.createSubscription({
          business_id: biz.id,
          plan_id,
          status: "trial",
          trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        });
      await repo.createBookingRules({ business_id: biz.id });
      return { ...biz, temp_password: tempPw, user_already_exists: userExisted };
    },
    async editBusiness(businessId: string, data: Record<string, unknown>, supabase?: any) {
      const { owner_email, ...businessData } = data;
      const { data: biz, error } = await repo.updateBusiness(businessId, businessData);
      if (error) throw new AppError(400, error.message);

      let tempPassword: string | null = null;
      if (supabase && typeof owner_email === "string" && owner_email.trim()) {
        const email = owner_email.trim();
        const { data: owner } = await repo.findOwner(businessId);
        const currentOwnerId = owner?.user_id as string | undefined;

        const users = await fetchAllUsers(supabase);
        const existing = users.find((u: any) => u.email === email);
        let newOwnerId: string | null;
        if (existing) {
          newOwnerId = existing.id as string;
        } else {
          tempPassword = generateTempPassword();
          const { data: created, error: cErr } = await supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { role: "business_owner" },
          });
          if (cErr) throw new AppError(400, cErr.message);
          newOwnerId = created?.user?.id ?? null;
        }

        if (newOwnerId && newOwnerId !== currentOwnerId) {
          if (currentOwnerId) {
            await repo.deleteMemberships(newOwnerId, businessId);
            await repo.updateOwnerMember(businessId, newOwnerId);
            const { count } = await repo.countMembershipsByUser(currentOwnerId);
            if (!count || count === 0) {
              try {
                await supabase.auth.admin.deleteUser(currentOwnerId);
              } catch (e) {
                console.error("[admin] failed to delete former owner", currentOwnerId, e);
              }
            }
          } else {
            await repo.createMember({ business_id: businessId, user_id: newOwnerId, role: "owner" });
          }
        }
      }

      return tempPassword ? { ...biz, temp_password: tempPassword } : biz;
    },
    async removeBusiness(businessId: string) {
      const { error } = await repo.deleteBusiness(businessId);
      if (error) throw new AppError(400, error.message);
      return { success: true };
    },
    async analytics() {
      const [bR, aR, sR] = await Promise.all([
        repo.countBusinesses(),
        repo.countAppointments(),
        repo.countSubscriptions(),
      ]);
      return {
        total_businesses: bR.count || 0,
        total_appointments: aR.count || 0,
        active_subscriptions: (sR.data || []).filter(
          (s: any) => s.status === "active" || s.status === "trial"
        ).length,
      };
    },
    async impersonate(businessId: string, adminUserId: string) {
      const { data: biz, error } = await repo.findBusinessById(businessId);
      if (error || !biz) throw new AppError(404, "Business not found");
      await repo.insertLog({
        business_id: businessId,
        type: "impersonation_start",
        channel: "system",
        template_id: "impersonation",
        status: "logged",
        customer_id: null,
        sent_at: new Date().toISOString(),
        error: `Admin ${adminUserId} started impersonating ${biz.name} (${businessId})`,
      });
      return { impersonating: true, business: biz, admin_user_id: adminUserId };
    },
    async stopImpersonate(businessId: string | undefined, adminUserId: string) {
      if (businessId)
        await repo.insertLog({
          business_id: businessId,
          type: "impersonation_stop",
          channel: "system",
          template_id: "impersonation",
          status: "logged",
          customer_id: null,
          sent_at: new Date().toISOString(),
          error: `Admin ${adminUserId} stopped impersonating ${businessId}`,
        });
      return { impersonating: false };
    },
    async listPlans() {
      const { data, error } = await repo.findPlans();
      if (error) throw new AppError(500, error.message);
      return data;
    },
    async addPlan(data: Record<string, unknown>) {
      const { data: p, error } = await repo.createPlan(data);
      if (error) throw new AppError(400, error.message);
      return p;
    },
    async editPlan(planId: string, data: Record<string, unknown>) {
      const { data: p, error } = await repo.updatePlan(planId, data);
      if (error) throw new AppError(400, error.message);
      return p;
    },
  };
}
