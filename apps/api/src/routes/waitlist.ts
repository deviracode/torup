import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId } from "../lib/params.js";
import {
  requireAuth,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/waitlist
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("waitlist")
        .select("*, services(name_he, name_ar, name_en), customers(name, phone)")
        .eq("business_id", getBusinessId(req))
        .eq("status", "waiting")
        .order("created_at");

      if (error) throw new AppError(500, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/waitlist
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const businessId = getBusinessId(req);
    const { service_id, customer_id, requested_date, requested_time } = req.body;

    const { data, error } = await supabase
      .from("waitlist")
      .insert({
        business_id: businessId,
        service_id,
        customer_id,
        requested_date,
        requested_time,
        status: "waiting",
      })
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
