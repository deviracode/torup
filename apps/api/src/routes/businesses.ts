import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import {
  requireAuth,
  requireRole,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: RouterType = Router();

// GET /businesses/me — Auth: get current user's business
router.get(
  "/me",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.businessId) {
        throw new AppError(404, "No business found for this user");
      }
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", req.businessId)
        .single();

      if (error || !data) throw new AppError(404, "Business not found");
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:slugOrId — Public/Auth: get business by slug or UUID
router.get("/:slugOrId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const param = req.params.slugOrId as string;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);

    let query = supabase.from("businesses").select("*");

    if (isUUID) {
      query = query.eq("id", param);
    } else {
      query = query.eq("slug", param).eq("is_active", true);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      throw new AppError(404, "Business not found");
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /businesses/:id — Owner: update business
router.patch(
  "/:id",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

export default router;
