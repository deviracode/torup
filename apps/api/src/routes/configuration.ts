import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { getBusinessId, getParam, getUserClient } from "../lib/params";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { createConfigRepo } from "../modules/configuration/configuration.repository";
import { createConfigService } from "../modules/configuration/configuration.service";

const router: RouterType = Router({ mergeParams: true });

function publicSvc() { return createConfigService(createConfigRepo(createServiceClient())); }
function authSvc(req: AuthenticatedRequest) { return createConfigService(createConfigRepo(getUserClient(req))); }

// ── Working Hours ──
router.get("/working-hours", async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await publicSvc().getWorkingHours(getBusinessId(req))); } catch (err) { next(err); }
});
router.put("/working-hours", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await authSvc(req).setWorkingHours(getBusinessId(req), req.body)); } catch (err) { next(err); }
});

// ── Breaks ──
router.get("/breaks", async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await publicSvc().getBreaks(getBusinessId(req))); } catch (err) { next(err); }
});
router.post("/breaks", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.status(201).json(await authSvc(req).addBreak(getBusinessId(req), req.body)); } catch (err) { next(err); }
});
router.delete("/breaks/:breakId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await authSvc(req).removeBreak(getParam(req, "breakId"), getBusinessId(req)); res.status(204).send(); } catch (err) { next(err); }
});

// ── Booking Rules ──
router.get("/booking-rules", async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await publicSvc().getBookingRules(getBusinessId(req))); } catch (err) { next(err); }
});
router.put("/booking-rules", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await authSvc(req).setBookingRules(getBusinessId(req), req.body)); } catch (err) { next(err); }
});

// ── Reminder Settings ──
router.get("/reminder-settings", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await authSvc(req).getReminderSettings(getBusinessId(req))); } catch (err) { next(err); }
});
router.post("/reminder-settings", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.status(201).json(await authSvc(req).addReminderSetting(getBusinessId(req), req.body.minutes_before)); } catch (err) { next(err); }
});
router.patch("/reminder-settings/:reminderId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (typeof req.body.is_active !== "boolean") throw new AppError(400, "is_active must be a boolean");
  try { res.json(await authSvc(req).editReminderSetting(getParam(req, "reminderId"), getBusinessId(req), req.body.is_active)); } catch (err) { next(err); }
});
router.delete("/reminder-settings/:reminderId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await authSvc(req).removeReminderSetting(getParam(req, "reminderId"), getBusinessId(req)); res.status(204).send(); } catch (err) { next(err); }
});

export default router;
