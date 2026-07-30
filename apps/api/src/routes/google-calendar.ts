import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { getBusinessId } from "../lib/params";
import { createServiceClient } from "../lib/supabase";
import { getAuthUrl, listCalendars, syncGoogleCalendar } from "../services/google-calendar";
import { AppError } from "../middleware/error-handler";
import { createGcalRepo } from "../modules/google-calendar/google-calendar.repository";
import { createGcalService } from "../modules/google-calendar/google-calendar.service";

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

router.get("/auth-url", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), (req: AuthenticatedRequest, res: Response) => { res.json({ url: getAuthUrl(getBusinessId(req)) }); });
router.post("/connect", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { const { code } = req.body; if (!code) throw new AppError(400, "Authorization code required"); res.json(await createGcalService(createGcalRepo(createServiceClient())).connect(getBusinessId(req), code)); } catch (err) { next(err); }
});
router.delete("/connect", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await createGcalService(createGcalRepo(createServiceClient())).disconnect(getBusinessId(req))); } catch (err) { next(err); }
});
// status, settings, events use service-role (google_calendar_tokens/events have deny-all RLS)
router.get("/status", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await createGcalService(createGcalRepo(createServiceClient())).status(getBusinessId(req))); } catch (err) { next(err); }
});
router.patch("/settings", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await createGcalService(createGcalRepo(createServiceClient())).updateSettings(getBusinessId(req), req.body)); } catch (err) { next(err); }
});
router.get("/events", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { date } = req.query; if (!date) throw new AppError(400, "date is required"); try { res.json(await createGcalService(createGcalRepo(createServiceClient())).events(getBusinessId(req), date as string)); } catch (err) { next(err); }
});
router.post("/sync", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await syncGoogleCalendar(getBusinessId(req))); } catch (err) { next(err); }
});
router.get("/calendars", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ calendars: await listCalendars(getBusinessId(req)) }); } catch (err) { next(err); }
});

export default router;
