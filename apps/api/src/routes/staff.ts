import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId, getParam } from "../lib/params.js";
import {
  requireAuth,
  requireRole,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/staff
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("business_members")
        .select("*")
        .eq("business_id", getBusinessId(req))
        .order("created_at");

      if (error) throw new AppError(500, error.message);
      if (!data || data.length === 0) { res.json([]); return; }

      // Enrich with auth user data (email + name)
      const userResults = await Promise.all(
        data.map((m: Record<string, unknown>) =>
          supabase.auth.admin.getUserById(m.user_id as string)
        )
      );

      const enriched = data.map((m: Record<string, unknown>, i: number) => {
        const authUser = userResults[i].data?.user;
        return {
          ...m,
          user: authUser
            ? {
                email: authUser.email,
                user_metadata: authUser.user_metadata,
              }
            : undefined,
        };
      });

      res.json(enriched);
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/staff
router.post(
  "/",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const { email, role, display_name } = req.body;

      if (!email) throw new AppError(400, "Email is required");

      const { data: users, error: lookupErr } = await supabase.auth.admin.listUsers();
      if (lookupErr) throw new AppError(500, lookupErr.message);

      const user = users.users.find((u) => u.email === email);
      if (!user) throw new AppError(404, "No user found with that email. They must sign up first.");

      const { data, error } = await supabase
        .from("business_members")
        .insert({
          business_id: businessId,
          user_id: user.id,
          role: role || "staff",
          display_name: display_name || user.user_metadata?.name || email,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new AppError(409, "This user is already a staff member");
        throw new AppError(400, error.message);
      }
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /businesses/:businessId/staff/:memberId
router.delete(
  "/:memberId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("business_members")
        .delete()
        .eq("id", getParam(req, "memberId"))
        .eq("business_id", getBusinessId(req));

      if (error) throw new AppError(400, error.message);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
