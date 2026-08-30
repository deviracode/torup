import { Router, type Response, type NextFunction } from "express";
import { requireAuth, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { createServiceClient } from "../lib/supabase";
import { createChangeRequestRepo } from "../modules/appointments/change-request.repository";
import { createChangeRequestService } from "../modules/appointments/change-request.service";
import { createChangeRequestDeps } from "../modules/appointments/change-request.deps";

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const repo = createChangeRequestRepo(createServiceClient());
      const { data, error } = await repo.listPendingByBusiness(req.params.businessId as string);
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/approve",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const service = createChangeRequestService(createChangeRequestDeps());
      const result = await service.approve(
        req.params.businessId as string,
        req.params.id as string,
        req.userId ?? ""
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/reject",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const service = createChangeRequestService(createChangeRequestDeps());
      const result = await service.reject(
        req.params.businessId as string,
        req.params.id as string,
        req.userId ?? ""
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
