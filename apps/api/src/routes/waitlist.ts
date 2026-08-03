import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createAnonClient } from "../lib/supabase";
import { getBusinessId, getUserClient } from "../lib/params";
import { requireAuth, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { createWaitlistRepo } from "../modules/waitlist/waitlist.repository";
import { createWaitlistService } from "../modules/waitlist/waitlist.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const svc = createWaitlistService(createWaitlistRepo(getUserClient(req)));
    res.json(await svc.list(getBusinessId(req)));
  } catch (err) { next(err); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const svc = createWaitlistService(createWaitlistRepo(createAnonClient()));
    res.status(201).json(await svc.join({ business_id: getBusinessId(req), ...req.body }));
  } catch (err) { next(err); }
});

export default router;
