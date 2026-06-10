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

const SERVICE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

// GET /businesses/:businessId/services
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const businessId = getBusinessId(req);

    const [servicesResult, categoriesResult] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("service_categories")
        .select("*")
        .eq("business_id", businessId)
        .order("sort_order"),
    ]);

    if (servicesResult.error) throw new AppError(500, servicesResult.error.message);

    const categories = categoriesResult.data || [];
    const services = servicesResult.data || [];

    if (categories.length === 0) {
      res.json(services);
      return;
    }

    res.json({ categories, services });
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
      const randomColor = SERVICE_COLORS[Math.floor(Math.random() * SERVICE_COLORS.length)];
      const body = { ...req.body, color: req.body.color ?? randomColor };
      if (typeof body.color !== "string" || !/^#([A-Fa-f0-9]{6})$/.test(body.color)) {
        throw new AppError(400, "Invalid color format. Use 6-digit hex, e.g. #6366f1");
      }
      const { data, error } = await supabase
        .from("services")
        .insert({ ...body, business_id: getBusinessId(req) })
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
      if (req.body.color !== undefined && req.body.color !== null) {
        if (typeof req.body.color !== "string" || !/^#([A-Fa-f0-9]{6})$/.test(req.body.color)) {
          throw new AppError(400, "Invalid color format. Use 6-digit hex, e.g. #6366f1");
        }
      }
      const { data, error } = await supabase
        .from("services")
        .update(req.body)
        .eq("id", getParam(req, "serviceId"))
        .eq("business_id", getBusinessId(req))
        .select();

      if (error) throw new AppError(400, error.message);
      res.json(data?.[0] ?? {});
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
