import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createAnonClient } from "../lib/supabase";
import { getBusinessId, getParam, getUserClient } from "../lib/params";
import { requireAuth, requireBusinessAccess, type AuthenticatedRequest } from "../middleware/auth";
import { createCustomerRepo } from "../modules/customers/customers.repository";
import { createCustomerService } from "../modules/customers/customers.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await createCustomerService(createCustomerRepo(getUserClient(req))).list(getBusinessId(req), req.query.search as string | undefined)); } catch (err) { next(err); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await createCustomerService(createCustomerRepo(createAnonClient())).findOrCreate(req.body)); } catch (err) { next(err); }
});

router.patch("/:customerId", requireAuth, requireBusinessAccess, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json(await createCustomerService(createCustomerRepo(getUserClient(req))).edit(getParam(req, "customerId"), req.body)); } catch (err) { next(err); }
});

export default router;
