import { Router, type Request, type Response, type NextFunction } from "express";
import { AppError } from "../middleware/error-handler";
import { createServiceClient } from "../lib/supabase";
import { createAppointmentLinkRepo } from "../modules/appointments/appointment-link.repository";
import { createAppointmentLinkService } from "../modules/appointments/appointment-link.service";
import { createChangeRequestService } from "../modules/appointments/change-request.service";
import { createChangeRequestDeps } from "../modules/appointments/change-request.deps";
import { sendAttendanceOwnerNotification } from "../services/notifications";

const router: Router = Router();

function linkService() {
  const repo = createAppointmentLinkRepo(createServiceClient());
  return createAppointmentLinkService(repo, { notifyOwnerOfAttendance: sendAttendanceOwnerNotification });
}

function requirePhone(req: Request): string {
  const phone = req.body?.phone;
  if (!phone || typeof phone !== "string") throw new AppError(400, "Phone number is required");
  return phone;
}

function validateProposedStartTime(type: "edit" | "cancel", value: unknown): string | undefined {
  if (type === "cancel") return undefined;
  if (typeof value !== "string" || isNaN(new Date(value).getTime())) {
    throw new AppError(400, "proposedStartTime is required and must be a valid ISO date for edit requests");
  }
  return value;
}

router.post("/:token/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = requirePhone(req);
    const summary = await linkService().verifyAndGet(req.params.token as string, phone);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.post("/:token/attendance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = requirePhone(req);
    const decision = req.body?.decision;
    if (decision !== "confirm" && decision !== "reject") throw new AppError(400, "decision must be 'confirm' or 'reject'");
    const result = await linkService().setAttendance(req.params.token as string, phone, decision);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/:token/change-request", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = requirePhone(req);
    const type = req.body?.type;
    if (type !== "edit" && type !== "cancel") throw new AppError(400, "type must be 'edit' or 'cancel'");
    const summary = await linkService().verifyAndGet(req.params.token as string, phone);
    const proposedStartTime = validateProposedStartTime(type, req.body?.proposedStartTime);
    const changeRequestService = createChangeRequestService(createChangeRequestDeps());
    const result = await changeRequestService.create(summary.id, {
      type,
      proposedStartTime,
      reason: req.body?.reason,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
