import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { createServiceClient, createAnonClient } from "../lib/supabase";
import { getBusinessId, getParam, getUserClient } from "../lib/params";
import {
  requireAuth,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { createAppointmentRepo } from "../modules/appointments/appointment.repository";
import { createAppointmentService, type AppointmentDeps } from "../modules/appointments/appointment.service";
import { pushAppointmentToGoogle } from "../services/google-calendar";
import {
  sendAppointmentNotification,
  sendManagerNotification,
  sendApprovalNotification,
  sendRejectionNotification,
} from "../services/notifications";
import { cacheGet, cacheSet, cacheClear } from "../lib/redis";

const deps: AppointmentDeps = {
  cache: { get: cacheGet, set: cacheSet, clear: cacheClear },
  notify: {
    sendAppointment: sendAppointmentNotification,
    sendManager: sendManagerNotification,
    sendApproval: sendApprovalNotification,
    sendRejection: sendRejectionNotification as AppointmentDeps["notify"]["sendRejection"],
  },
  gcal: { pushAppointment: pushAppointmentToGoogle },
};

function service(req: AuthenticatedRequest) {
  const repo = createAppointmentRepo(getUserClient(req));
  return createAppointmentService(repo, deps);
}

function publicService() {
  const repo = createAppointmentRepo(createAnonClient());
  return createAppointmentService(repo, deps);
}

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/appointments
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await service(req).list(getBusinessId(req), {
        date: req.query.date as string | undefined,
        status: req.query.status as string | undefined,
        staffId: req.query.staffId as string | undefined,
      });
      res.setHeader("X-Cache", result.cache);
      res.json(result.data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /businesses/:businessId/appointments — public
router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await publicService().book(getBusinessId(req), req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /businesses/:businessId/appointments/:appointmentId/status
router.patch(
  "/:appointmentId/status",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service(req).changeStatus(
        getBusinessId(req),
        getParam(req, "appointmentId"),
        req.body.status,
        req.userRole ?? "staff",
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /businesses/:businessId/appointments/:appointmentId/reschedule
router.patch(
  "/:appointmentId/reschedule",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await service(req).reschedule(
        getBusinessId(req),
        getParam(req, "appointmentId"),
        req.body.start_time,
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /businesses/:businessId/appointments/:appointmentId/approve
router.post(
  "/:appointmentId/approve",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const appointmentId = getParam(req, "appointmentId");
      const businessId = getBusinessId(req);

      // RLS guard: verify the appointment belongs to this business
      const guardRepo = createAppointmentRepo(getUserClient(req));
      const { data: target } = await guardRepo.findById(appointmentId, businessId, "id");
      if (!target) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }

      // Service-role repo for internal approval logic
      const svcRepo = createAppointmentRepo(createServiceClient());
      const result = await createAppointmentService(svcRepo, deps).approve(appointmentId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /businesses/:businessId/appointments/:appointmentId/reject
router.post(
  "/:appointmentId/reject",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const appointmentId = getParam(req, "appointmentId");
      const businessId = getBusinessId(req);

      // RLS guard
      const guardRepo = createAppointmentRepo(getUserClient(req));
      const { data: target } = await guardRepo.findById(appointmentId, businessId, "id");
      if (!target) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }

      const svcRepo = createAppointmentRepo(createServiceClient());
      const result = await createAppointmentService(svcRepo, deps).reject(appointmentId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
