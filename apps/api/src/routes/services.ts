import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { getBusinessId, getParam, getUserClient } from "../lib/params";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { createServiceRepo } from "../modules/services/services.repository";
import { createServiceService } from "../modules/services/services.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await createServiceService(createServiceRepo(createServiceClient())).list(getBusinessId(req))); } catch (err) { next(err); }
});
router.post("/", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.status(201).json(await createServiceService(createServiceRepo(getUserClient(req))).add(getBusinessId(req), req.body)); } catch (err) { next(err); }
});
router.patch("/:serviceId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await createServiceService(createServiceRepo(getUserClient(req))).edit(getParam(req, "serviceId"), getBusinessId(req), req.body)); } catch (err) { next(err); }
});
router.delete("/:serviceId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await createServiceService(createServiceRepo(getUserClient(req))).remove(getParam(req, "serviceId"), getBusinessId(req)); res.status(204).send(); } catch (err) { next(err); }
});

export default router;
