import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { getBusinessId, getUserClient } from "../lib/params";
import { requireAuth, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { createAnalyticsRepo } from "../modules/analytics/analytics.repository";
import { createAnalyticsService } from "../modules/analytics/analytics.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const svc = createAnalyticsService(createAnalyticsRepo(getUserClient(req)));
    res.json(await svc.get(getBusinessId(req), (req.query.period as string) || "month"));
  } catch (err) { next(err); }
});

export default router;
