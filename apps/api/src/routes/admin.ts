import { Router, type Router as RouterType } from "express";
import { createServiceClient } from "../lib/supabase";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { createAdminRepo } from "../modules/admin/admin.repository";
import { createAdminService } from "../modules/admin/admin.service";

const router: RouterType = Router();
router.use(requireAuth, requireRole("super_admin"));

function svc() { return createAdminService(createAdminRepo(createServiceClient())); }

router.get("/businesses", async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await svc().listBusinesses(createServiceClient(), { category: req.query.category as string, status: req.query.status as string, search: req.query.search as string })); } catch (e) { next(e); }
});
router.post("/businesses", async (req: AuthenticatedRequest, res, next) => {
  try { res.status(201).json(await svc().onboard(createServiceClient(), req.body)); } catch (e) { next(e); }
});
router.patch("/businesses/:id", async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await svc().editBusiness(req.params.id as string, req.body, createServiceClient())); } catch (e) { next(e); }
});
router.delete("/businesses/:id", async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await svc().removeBusiness(req.params.id as string)); } catch (e) { next(e); }
});
router.get("/analytics", async (_req: AuthenticatedRequest, res, next) => {
  try { res.json(await svc().analytics()); } catch (e) { next(e); }
});
router.post("/impersonate", async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await svc().impersonate(req.body.business_id, req.userId ?? "")); } catch (e) { next(e); }
});
router.post("/stop-impersonate", async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await svc().stopImpersonate(req.body.business_id, req.userId ?? "")); } catch (e) { next(e); }
});
router.get("/plans", async (_req: AuthenticatedRequest, res, next) => { try { res.json(await svc().listPlans()); } catch (e) { next(e); } });
router.post("/plans", async (req: AuthenticatedRequest, res, next) => { try { res.status(201).json(await svc().addPlan(req.body)); } catch (e) { next(e); } });
router.patch("/plans/:id", async (req: AuthenticatedRequest, res, next) => { try { res.json(await svc().editPlan(req.params.id as string, req.body)); } catch (e) { next(e); } });

export default router;
