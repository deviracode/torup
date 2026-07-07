import { Router, type Router as RouterType } from "express";
import { createServiceClient } from "../lib/supabase.js";
import {
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: RouterType = Router();

// All admin routes require super_admin
router.use(requireAuth, requireRole("super_admin"));

// GET /admin/businesses — List all businesses
router.get(
  "/businesses",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const { category, status, search } = req.query;

      let query = supabase
        .from("businesses")
        .select("*, subscriptions(status, plan_id, plans(name))")
        .order("created_at", { ascending: false });

      if (category) {
        query = query.eq("category", category as string);
      }

      if (status === "active") {
        query = query.eq("is_active", true);
      } else if (status === "inactive") {
        query = query.eq("is_active", false);
      }

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,slug.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw new AppError(500, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/businesses — Onboard new business
router.post(
  "/businesses",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const { name, category, phone, email, plan_id, owner_email } = req.body;

      // Generate slug from name
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05ff\u0600-\u06ff]+/g, "-")
        .replace(/^-|-$/g, "");

      // Create business
      const { data: business, error: bizErr } = await supabase
        .from("businesses")
        .insert({
          name,
          slug,
          category,
          phone,
          email,
          default_language: "he",
        })
        .select()
        .single();

      if (bizErr) throw new AppError(400, bizErr.message);

      // Create or find owner user, set a temp password, link to business
      let tempPassword: string | null = null;
      if (owner_email) {
        let ownerId: string | null = null;

        // Check if user already exists
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === owner_email);

        tempPassword = Math.random().toString(36).slice(-10) + "A1!";

        if (existing) {
          ownerId = existing.id;
          await supabase.auth.admin.updateUserById(existing.id, {
            password: tempPassword,
          });
        } else {
          const { data: created, error: createErr } =
            await supabase.auth.admin.createUser({
              email: owner_email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { role: "business_owner" },
            });
          if (createErr) throw new AppError(400, createErr.message);
          if (created?.user) ownerId = created.user.id;
        }

        if (ownerId) {
          await supabase.from("business_members").insert({
            business_id: business.id,
            user_id: ownerId,
            role: "owner",
          });
        }
      }

      // Create subscription
      if (plan_id) {
        await supabase.from("subscriptions").insert({
          business_id: business.id,
          plan_id,
          status: "trial",
          trial_ends_at: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
      }

      // Create default booking rules
      await supabase.from("booking_rules").insert({
        business_id: business.id,
      });

      res.status(201).json({ ...business, temp_password: tempPassword });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/businesses/:id
router.patch(
  "/businesses/:id",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("businesses")
        .update(req.body)
        .eq("id", req.params.id)
        .select()
        .single();

      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /admin/businesses/:id
router.delete(
  "/businesses/:id",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("businesses")
        .delete()
        .eq("id", req.params.id);

      if (error) throw new AppError(400, error.message);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/analytics
router.get(
  "/analytics",
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();

      const [businessesResult, appointmentsResult, subscriptionsResult] =
        await Promise.all([
          supabase
            .from("businesses")
            .select("id, created_at, is_active", { count: "exact" }),
          supabase
            .from("appointments")
            .select("id, created_at, status", { count: "exact" }),
          supabase
            .from("subscriptions")
            .select("id, status", { count: "exact" }),
        ]);

      res.json({
        total_businesses: businessesResult.count || 0,
        total_appointments: appointmentsResult.count || 0,
        active_subscriptions: (subscriptionsResult.data || []).filter(
          (s: { status: string }) => s.status === "active" || s.status === "trial"
        ).length,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/impersonate — Start impersonation session
router.post(
  "/impersonate",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const { business_id } = req.body;

      if (!business_id) throw new AppError(400, "business_id required");

      // Verify business exists
      const { data: business, error: bizErr } = await supabase
        .from("businesses")
        .select("id, name, slug")
        .eq("id", business_id)
        .single();

      if (bizErr || !business) throw new AppError(404, "Business not found");

      // Log the impersonation event
      await supabase.from("notifications_log").insert({
        business_id,
        type: "impersonation_start",
        channel: "system",
        template_id: "impersonation",
        status: "logged",
        customer_id: null,
        sent_at: new Date().toISOString(),
        error: `Admin ${req.userId} started impersonating business ${business.name} (${business_id})`,
      });

      res.json({
        impersonating: true,
        business,
        admin_user_id: req.userId,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/stop-impersonate — Stop impersonation
router.post(
  "/stop-impersonate",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const { business_id } = req.body;

      if (business_id) {
        await supabase.from("notifications_log").insert({
          business_id,
          type: "impersonation_stop",
          channel: "system",
          template_id: "impersonation",
          status: "logged",
          customer_id: null,
          sent_at: new Date().toISOString(),
          error: `Admin ${req.userId} stopped impersonating business ${business_id}`,
        });
      }

      res.json({ impersonating: false });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/plans — List all plans
router.get(
  "/plans",
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("monthly_price");

      if (error) throw new AppError(500, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/plans — Create plan
router.post(
  "/plans",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const body = { ...req.body };

      // Auto-set AI token limit when AI bot is enabled
      if (body.has_ai_bot && !body.max_ai_tokens_monthly) {
        body.max_ai_tokens_monthly = 2400000;
      }
      if (!body.has_ai_bot) {
        body.max_ai_tokens_monthly = 0;
      }

      const { data, error } = await supabase
        .from("plans")
        .insert(body)
        .select()
        .single();

      if (error) throw new AppError(400, error.message);
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/plans/:id — Update plan
router.patch(
  "/plans/:id",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const supabase = createServiceClient();
      const body = { ...req.body };

      if (body.has_ai_bot && !body.max_ai_tokens_monthly) {
        body.max_ai_tokens_monthly = 2400000;
      }
      if (body.has_ai_bot === false) {
        body.max_ai_tokens_monthly = 0;
      }

      const { data, error } = await supabase
        .from("plans")
        .update(body)
        .eq("id", req.params.id)
        .select()
        .single();

      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
