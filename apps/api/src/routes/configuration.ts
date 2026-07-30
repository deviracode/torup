import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { getBusinessId, getParam } from "../lib/params";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { createConfigRepo } from "../modules/configuration/configuration.repository";
import { createConfigService } from "../modules/configuration/configuration.service";

function svc(req?: AuthenticatedRequest) { return createConfigService(createConfigRepo(createServiceClient())); }

const router: RouterType = Router({ mergeParams: true });

router.get("/working-hours", async (req: Request, res: Response, next: NextFunction) => { try { res.json(await svc().getWorkingHours(getBusinessId(req))); } catch (err) { next(err); } });
router.put("/working-hours", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await svc().setWorkingHours(getBusinessId(req), req.body)); } catch (err) { next(err); } });
router.get("/breaks", async (req: Request, res: Response, next: NextFunction) => { try { res.json(await svc().getBreaks(getBusinessId(req))); } catch (err) { next(err); } });
router.post("/breaks", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.status(201).json(await svc().addBreak(getBusinessId(req), req.body)); } catch (err) { next(err); } });
router.delete("/breaks/:breakId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { await svc().removeBreak(getParam(req, "breakId"), getBusinessId(req)); res.status(204).send(); } catch (err) { next(err); } });
router.get("/booking-rules", async (req: Request, res: Response, next: NextFunction) => { try { res.json(await svc().getBookingRules(getBusinessId(req))); } catch (err) { next(err); } });
router.put("/booking-rules", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await svc().setBookingRules(getBusinessId(req), req.body)); } catch (err) { next(err); } });
router.get("/reminder-settings", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.json(await svc().getReminderSettings(getBusinessId(req))); } catch (err) { next(err); } });
router.post("/reminder-settings", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { res.status(201).json(await svc().addReminderSetting(getBusinessId(req), req.body.minutes_before)); } catch (err) { next(err); } });
router.patch("/reminder-settings/:reminderId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (typeof req.body.is_active !== "boolean") throw new AppError(400, "is_active must be a boolean"); try { res.json(await svc().editReminderSetting(getParam(req, "reminderId"), getBusinessId(req), req.body.is_active)); } catch (err) { next(err); }
});
router.delete("/reminder-settings/:reminderId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { await svc().removeReminderSetting(getParam(req, "reminderId"), getBusinessId(req)); res.status(204).send(); } catch (err) { next(err); } });

export default router;
