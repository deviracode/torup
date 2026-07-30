import { Router, type Router as RouterType } from "express";
import { getUserClient, getBusinessId } from "../lib/params";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { createNotificationRepo } from "../modules/notifications/notifications.repository";
import { createNotificationService } from "../modules/notifications/notifications.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const repo = createNotificationRepo(getUserClient(req));
    const svc = createNotificationService(repo);
    const { limit, offset, type, appointment_id } = req.query;

    const data = await svc.list(getBusinessId(req), {
      limit: Number(limit) || undefined,
      offset: Number(offset) || undefined,
      type: type as string | undefined,
      appointmentId: appointment_id as string | undefined,
    });

    res.json({ notifications: data });
  } catch (err) { next(err); }
});

export default router;
