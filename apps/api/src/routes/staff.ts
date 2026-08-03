import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { getBusinessId, getParam, getUserClient } from "../lib/params";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { createStaffRepo } from "../modules/staff/staff.repository";
import { createStaffService } from "../modules/staff/staff.service";

const router: RouterType = Router({ mergeParams: true });

function svc(req: AuthenticatedRequest) {
  return createStaffService(createStaffRepo(getUserClient(req)));
}

router.get("/", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).list(getUserClient(req), getBusinessId(req))); } catch (e) { next(e); }
});
router.post("/", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.status(201).json(await svc(req).add(getUserClient(req), getBusinessId(req), req.body)); } catch (e) { next(e); }
});
router.patch("/:memberId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).edit(getParam(req, "memberId"), getBusinessId(req), req.body)); } catch (e) { next(e); }
});
router.get("/:memberId/services", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).getServices(getParam(req, "memberId"))); } catch (e) { next(e); }
});
router.put("/:memberId/services", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!Array.isArray(req.body.service_ids)) throw new AppError(400, "service_ids must be an array");
  try { res.json(await svc(req).setServices(getBusinessId(req), getParam(req, "memberId"), req.body.service_ids)); } catch (e) { next(e); }
});
router.get("/:memberId/time-off", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await svc(req).getTimeOff(getParam(req, "memberId"))); } catch (e) { next(e); }
});
router.post("/:memberId/time-off", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { start_date, end_date } = req.body;
  if (!start_date || !end_date) throw new AppError(400, "start_date and end_date are required");
  try { res.status(201).json(await svc(req).addTimeOff(getBusinessId(req), getParam(req, "memberId"), start_date, end_date)); } catch (e) { next(e); }
});
router.delete("/:memberId/time-off", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!Array.isArray(req.body.break_ids) || req.body.break_ids.length === 0) throw new AppError(400, "break_ids must be a non-empty array");
  try { await svc(req).removeTimeOff(getBusinessId(req), getParam(req, "memberId"), req.body.break_ids); res.status(204).send(); } catch (e) { next(e); }
});
router.delete("/:memberId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await svc(req).remove(getParam(req, "memberId"), getBusinessId(req)); res.status(204).send(); } catch (e) { next(e); }
});

export default router;
