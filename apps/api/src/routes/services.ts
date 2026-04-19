import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
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

// GET /businesses/:businessId/services
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", getBusinessId(req))
      .eq("is_active", true)
      .order("sort_order");

    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /businesses/:businessId/services
router.post(
  "/",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("services")
        .insert({ ...req.body, business_id: getBusinessId(req) })
        .select()
        .single();

      if (error) throw new AppError(400, error.message);
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /businesses/:businessId/services/:serviceId
router.patch(
  "/:serviceId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("services")
        .update(req.body)
        .eq("id", getParam(req, "serviceId"))
        .eq("business_id", getBusinessId(req))
        .select()
        .single();

      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /businesses/:businessId/services/:serviceId (soft delete)
router.delete(
  "/:serviceId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("services")
        .update({ is_active: false })
        .eq("id", getParam(req, "serviceId"))
        .eq("business_id", getBusinessId(req));

      if (error) throw new AppError(400, error.message);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
