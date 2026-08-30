import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase";
import { getBusinessId } from "../lib/params";
import { AppError } from "../middleware/error-handler";
import { createAvailabilityRepo } from "../modules/availability/availability.repository";
import { createAvailabilityService } from "../modules/availability/availability.service";

const router: RouterType = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service_id, date } = req.query;
    if (!service_id || !date) throw new AppError(400, "service_id and date are required");
    // Uses the service-role client, not anon — anon has no SELECT policy on
    // appointments or staff_services at all, so this endpoint silently saw
    // zero existing appointments and zero staff assignments no matter what,
    // meaning it could NEVER detect a conflict. This route only returns
    // aggregated slot/capacity numbers, never raw appointment rows, so
    // bypassing RLS here doesn't expose anything.
    const svc = createAvailabilityService(createAvailabilityRepo(createServiceClient()));
    res.json(await svc.get(getBusinessId(req), service_id as string, date as string));
  } catch (err) { next(err); }
});

export default router;
