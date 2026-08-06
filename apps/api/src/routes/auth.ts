import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";

const router: RouterType = Router();

const resendCooldowns = new Map<string, number>();

router.post("/resend-confirmation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      throw new AppError(400, "Email is required");
    }

    const now = Date.now();
    const lastSent = resendCooldowns.get(email.toLowerCase());
    if (lastSent && now - lastSent < 60_000) {
      throw new AppError(429, "Please wait before requesting another email");
    }

    const supabase = createServiceClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.toLowerCase().trim(),
      options: { emailRedirectTo: `${process.env.APP_URL || "http://localhost:3000"}/auth/callback` },
    });

    if (error) throw new AppError(400, error.message);

    resendCooldowns.set(email.toLowerCase(), now);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
