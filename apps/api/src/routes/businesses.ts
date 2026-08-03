import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createAnonClient, createServiceClient } from "../lib/supabase";
import { getUserClient } from "../lib/params";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { createBusinessRepo } from "../modules/businesses/businesses.repository";
import { createBusinessService } from "../modules/businesses/businesses.service";

const router: RouterType = Router();

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = req.ctx?.memberships ?? [];
    const primaryBusinessId = req.businessId || req.query.business_id as string || memberships[0]?.businessId;

    if (!primaryBusinessId) throw new AppError(404, "No business found for this user");

    const business = await createBusinessService(createBusinessRepo(getUserClient(req))).getCurrent(primaryBusinessId);

    const enrichedMemberships = await Promise.all(
      memberships.map(async (m) => {
        const { data } = await createBusinessRepo(createServiceClient()).findById(m.businessId);
        return { businessId: m.businessId, role: m.role, name: (data as any)?.name ?? m.businessId };
      })
    );

    res.json({ ...business, memberships: enrichedMemberships });
  } catch (err) { next(err); }
});

router.get("/:slugOrId", async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await createBusinessService(createBusinessRepo(createAnonClient())).getBySlugOrId(req.params.slugOrId as string)); } catch (err) { next(err); }
});

router.patch("/:id", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await createBusinessService(createBusinessRepo(getUserClient(req))).edit(req.params.id as string, req.body)); } catch (err) { next(err); }
});

export default router;
