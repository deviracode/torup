import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { getBusinessId, getParam, getUserClient } from "../lib/params";
import { requireAuth, requireRole, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { createCategoryRepo } from "../modules/categories/categories.repository";
import { createCategoryService } from "../modules/categories/categories.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await createCategoryService(createCategoryRepo(createServiceClient())).list(getBusinessId(req))); } catch (err) { next(err); }
});

router.post("/", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.status(201).json(await createCategoryService(createCategoryRepo(getUserClient(req))).add(getBusinessId(req), req.body)); } catch (err) { next(err); }
});

router.patch("/:categoryId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await createCategoryService(createCategoryRepo(getUserClient(req))).edit(getParam(req, "categoryId"), getBusinessId(req), req.body); res.json({ ok: true }); } catch (err) { next(err); }
});

router.delete("/:categoryId", requireAuth, requireBusinessAccess, requireRole("business_owner", "super_admin"), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { await createCategoryService(createCategoryRepo(getUserClient(req))).remove(getParam(req, "categoryId"), getBusinessId(req)); res.status(204).send(); } catch (err) { next(err); }
});

export default router;
