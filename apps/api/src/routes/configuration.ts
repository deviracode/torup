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

// GET /businesses/:businessId/working-hours
router.get("/working-hours", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("working_hours")
      .select("*")
      .eq("business_id", getBusinessId(req))
      .order("day_of_week");

    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /businesses/:businessId/working-hours
router.put(
  "/working-hours",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);

      await supabase
        .from("working_hours")
        .delete()
        .eq("business_id", businessId)
        .is("staff_id", null);

      const rows = (req.body as Record<string, unknown>[]).map((row) => ({
        ...row,
        business_id: businessId,
      }));

      const { data, error } = await supabase
        .from("working_hours")
        .insert(rows)
        .select();

      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/breaks
router.get("/breaks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("breaks")
      .select("*")
      .eq("business_id", getBusinessId(req))
      .order("created_at");

    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /businesses/:businessId/breaks
router.post(
  "/breaks",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("breaks")
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

// DELETE /businesses/:businessId/breaks/:breakId
router.delete(
  "/breaks/:breakId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("breaks")
        .delete()
        .eq("id", getParam(req, "breakId"))
        .eq("business_id", getBusinessId(req));

      if (error) throw new AppError(400, error.message);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/booking-rules
router.get("/booking-rules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("booking_rules")
      .select("*")
      .eq("business_id", getBusinessId(req))
      .single();

    if (error) throw new AppError(404, "Booking rules not found");
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /businesses/:businessId/booking-rules
router.put(
  "/booking-rules",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("booking_rules")
        .upsert({ ...req.body, business_id: getBusinessId(req) })
        .select()
        .single();

      if (error) throw new AppError(400, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// GET /businesses/:businessId/reminder-settings
router.get("/reminder-settings", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("reminder_settings")
      .select("*")
      .eq("business_id", getBusinessId(req))
      .order("minutes_before");

    if (error) throw new AppError(500, error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /businesses/:businessId/reminder-settings
router.post(
  "/reminder-settings",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { minutes_before } = req.body;
      if (!minutes_before || typeof minutes_before !== "number" || minutes_before <= 0) {
        throw new AppError(400, "minutes_before must be a positive integer");
      }

      const { data, error } = await supabase
        .from("reminder_settings")
        .insert({ business_id: getBusinessId(req), minutes_before })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new AppError(409, "Reminder interval already exists");
        throw new AppError(400, error.message);
      }
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /businesses/:businessId/reminder-settings/:reminderId
router.patch(
  "/reminder-settings/:reminderId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { is_active } = req.body;
      if (typeof is_active !== "boolean") throw new AppError(400, "is_active must be a boolean");

      const { data, error } = await supabase
        .from("reminder_settings")
        .update({ is_active })
        .eq("id", getParam(req, "reminderId"))
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

// DELETE /businesses/:businessId/reminder-settings/:reminderId
router.delete(
  "/reminder-settings/:reminderId",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from("reminder_settings")
        .delete()
        .eq("id", getParam(req, "reminderId"))
        .eq("business_id", getBusinessId(req));

      if (error) throw new AppError(400, error.message);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
