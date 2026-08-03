import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createAnonClient } from "../lib/supabase";
import { getBusinessId } from "../lib/params";
import { AppError } from "../middleware/error-handler";
import { createAvailabilityRepo } from "../modules/availability/availability.repository";
import { createAvailabilityService } from "../modules/availability/availability.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service_id, date } = req.query;
    if (!service_id || !date) throw new AppError(400, "service_id and date are required");
    const svc = createAvailabilityService(createAvailabilityRepo(createAnonClient()));
    res.json(await svc.get(getBusinessId(req), service_id as string, date as string));
  } catch (err) { next(err); }
});

export default router;
