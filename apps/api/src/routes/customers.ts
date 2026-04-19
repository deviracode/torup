import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId, getParam } from "../lib/params.js";
import {
  requireAuth,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/customers?search=
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { search } = req.query;
      const businessId = getBusinessId(req);

      const { data: customerIds } = await supabase
        .from("appointments")
        .select("customer_id")
        .eq("business_id", businessId);

      const ids = [...new Set((customerIds || []).map((c: Record<string, unknown>) => c.customer_id as string))];
      if (ids.length === 0) { res.json([]); return; }

      let query = supabase.from("customers").select("*").in("id", ids);
      if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);

      const { data, error } = await query.order("name");
      if (error) throw new AppError(500, error.message);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/customers
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { phone, name, language_preference } = req.body;

    const { data: existing } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", phone)
      .single();

    if (existing) { res.json(existing); return; }

    const { data, error } = await supabase
      .from("customers")
      .insert({ phone, name, language_preference: language_preference || "he" })
      .select()
      .single();

    if (error) throw new AppError(400, error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /businesses/:businessId/customers/:customerId
router.patch(
  "/:customerId",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("customers")
        .update(req.body)
        .eq("id", getParam(req, "customerId"))
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
