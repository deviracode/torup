import { Router, type Router as RouterType } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { getBusinessId } from "../lib/params.js";
import { AppError } from "../middleware/error-handler.js";

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/notifications — List notification log
router.get(
  "/",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const businessId = getBusinessId(req);
      const supabase = createServiceClient();

      const { limit = "50", offset = "0", type, appointment_id } = req.query;

      let query = supabase
        .from("notifications_log")
        .select("*, customers(name, phone)")
        .eq("business_id", businessId)
        .order("sent_at", { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (type) {
        query = query.like("type", `${type}%`);
      }
      if (appointment_id) {
        query = query.eq("appointment_id", appointment_id as string);
      }

      const { data, error } = await query;
      if (error) throw new AppError(500, error.message);
      res.json({ notifications: data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
