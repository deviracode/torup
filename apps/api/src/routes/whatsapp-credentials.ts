import { Router, type Response, type NextFunction } from "express";
import {
  requireAuth,
  requireRole,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { getBusinessId } from "../lib/params";
import { createServiceClient } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { createWhatsAppCredentialsRepo } from "../modules/whatsapp/whatsapp-credentials.repository";
import { createWhatsAppCredentialsService } from "../modules/whatsapp/whatsapp-credentials.service";

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

function svc() {
  return createWhatsAppCredentialsService(createWhatsAppCredentialsRepo(createServiceClient()));
}

router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await svc().status(getBusinessId(req)));
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { phoneNumberId, accessToken, appSecret, verifyToken, displayPhone } = req.body ?? {};
      if (!phoneNumberId || !accessToken) {
        throw new AppError(400, "phoneNumberId and accessToken are required");
      }
      res.json(
        await svc().save(getBusinessId(req), {
          phoneNumberId,
          accessToken,
          appSecret,
          verifyToken,
          displayPhone,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/test",
  requireAuth,
  requireBusinessAccess,
  requireRole("business_owner", "super_admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { to } = req.body ?? {};
      if (!to) throw new AppError(400, "to is required");
      res.json(await svc().testSend(getBusinessId(req), to));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
