import { Router, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { AppError } from "../middleware/error-handler.js";

const router: Router = Router();

// GET /plans — public, returns active plans ordered by price
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("plans")
      .select("id, name, monthly_price, yearly_price, max_staff, max_appointments_monthly, has_whatsapp_bot, has_ai_bot, max_ai_tokens_monthly, is_active")
      .eq("is_active", true)
      .order("monthly_price", { ascending: true });

    if (error) throw new AppError(500, error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

export default router;
