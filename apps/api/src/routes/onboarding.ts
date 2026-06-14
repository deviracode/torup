import { Router, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";

const router: Router = Router();

// POST /onboarding/business — self-service business creation
// Creates a business + business_member (owner) for the authenticated user.
// Returns 409 if the user already owns a business.
router.post(
  "/business",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const userId = req.userId!;
      const { name, category, phone, address } = req.body;

      if (!name?.trim()) throw new AppError(400, "name is required");
      if (!category?.trim()) throw new AppError(400, "category is required");
      if (!phone?.trim()) throw new AppError(400, "phone is required");

      // Prevent duplicate: one business per user
      const { data: existing } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) throw new AppError(409, "User already has a business");

      // Generate slug from business name
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 60) + "-" + Math.random().toString(36).slice(2, 6);

      // Create business
      const { data: business, error: bizErr } = await supabase
        .from("businesses")
        .insert({
          name: name.trim(),
          slug,
          category,
          phone: phone.trim(),
          address: address?.trim() || null,
          email: req.userEmail || null,
          is_active: true,
        })
        .select()
        .single();

      if (bizErr) throw new AppError(400, bizErr.message);

      // Add user as business_owner
      const { error: memberErr } = await supabase
        .from("business_members")
        .insert({
          business_id: business.id,
          user_id: userId,
          role: "business_owner",
          display_name: req.userEmail || "Owner",
        });

      if (memberErr) throw new AppError(400, memberErr.message);

      res.status(201).json({ business_id: business.id });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
