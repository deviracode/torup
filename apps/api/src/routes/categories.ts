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

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("service_categories")
      .select("*")
      .eq("business_id", getBusinessId(req))
      .order("sort_order");
    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (err) { next(err); }
});

router.post(
  "/",
  requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { name_he, name_ar, name_en, sort_order } = req.body;
      if (!name_he) throw new AppError(400, "name_he is required");
      const { data, error } = await supabase
        .from("service_categories")
        .insert({ name_he, name_ar: name_ar || null, name_en: name_en || null, sort_order: sort_order ?? 0, business_id: getBusinessId(req) })
        .select()
        .single();
      if (error) throw new AppError(400, error.message);
      res.status(201).json(data);
    } catch (err) { next(err); }
  }
);

router.patch(
  "/:categoryId",
  requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("service_categories")
        .update(req.body)
        .eq("id", getParam(req, "categoryId"))
        .eq("business_id", getBusinessId(req))
        .select()
        .single();
      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) { next(err); }
  }
);

router.delete(
  "/:categoryId",
  requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("service_categories")
        .delete()
        .eq("id", getParam(req, "categoryId"))
        .eq("business_id", getBusinessId(req));
      if (error) throw new AppError(400, error.message);
      res.status(204).send();
    } catch (err) { next(err); }
  }
);

export default router;
