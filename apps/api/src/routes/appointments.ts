import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId, getParam } from "../lib/params.js";
import {
  requireAuth,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { validateTransition, canCancel } from "@torup/shared";
import { pushAppointmentToGoogle } from "../services/google-calendar.js";
import {
  sendAppointmentNotification,
  sendManagerNotification,
} from "../services/notifications.js";
import { approveAppointment, rejectAppointment } from "../services/appointment-actions.js";
import { cacheGet, cacheSet, cacheClear } from "../lib/redis.js";

const router: RouterType = Router({ mergeParams: true });

// Throws AppError(409, ...) if the slot is already at max capacity.
async function checkSlotCapacity(
  supabase: ReturnType<typeof createServiceClient>,
  businessId: string,
  serviceId: string,
  startDate: Date,
  service: { duration_minutes: number; buffer_minutes: number; max_capacity: number },
  excludeAppointmentId?: string
): Promise<void> {
  const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);
  const endWithBuffer = new Date(endDate.getTime() + service.buffer_minutes * 60 * 1000);

  let query = supabase
    .from("appointments")
    .select("id")
    .eq("business_id", businessId)
    .eq("service_id", serviceId)
    .lt("start_time", endWithBuffer.toISOString())
    .gt("end_time", startDate.toISOString())
    .not("status", "in", '("cancelled","no_show")');

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data: overlapping } = await query;

  if (overlapping && overlapping.length >= service.max_capacity) {
    throw new AppError(409, "Time slot is fully booked");
  }
}

// GET /businesses/:businessId/appointments
router.get(
  "/",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const { date, status, staffId } = req.query;
      const businessId = getBusinessId(req);

      // Build a deterministic cache key from all query params
      const cacheKey = `appts:${businessId}:${date ?? "all"}:${status ?? "all"}:${staffId ?? "all"}`;
      const cached = await cacheGet(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(JSON.parse(cached));
      }

      let query = supabase
        .from("appointments")
        .select("*, services(name_he, name_ar, name_en), customers(name, phone)")
        .eq("business_id", businessId)
        .order("start_time");

      if (date) {
        const getILOffset = (d: string) => {
          const ref = new Date(`${d}T12:00:00Z`);
          const utcH = ref.getUTCHours();
          const ilH = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hour12: false }).format(ref));
          let diff = ilH - utcH;
          if (diff < 0) diff += 24;
          if (diff > 12) diff -= 24;
          return `+${String(diff).padStart(2, "0")}:00`;
        };
        const tz = getILOffset(date as string);
        const dayStart = new Date(`${date}T00:00:00${tz}`).toISOString();
        const dayEnd = new Date(`${date}T23:59:59${tz}`).toISOString();
        query = query.gte("start_time", dayStart).lte("start_time", dayEnd);
      }
      if (status) query = query.eq("status", status as string);
      if (staffId) query = query.eq("staff_id", staffId as string);

      const { data, error } = await query;
      if (error) throw new AppError(500, error.message);

      // Cache for 30s — short enough to feel real-time, long enough to matter for day-switching
      await cacheSet(cacheKey, JSON.stringify(data), 30);
      res.setHeader("X-Cache", "MISS");
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/appointments
router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const businessId = getBusinessId(req);
    const { service_id, customer_id, staff_id, start_time, notes, created_via, status } = req.body;

    const { data: service, error: serviceErr } = await supabase
      .from("services")
      .select("duration_minutes, buffer_minutes, max_capacity")
      .eq("id", service_id)
      .eq("business_id", businessId)
      .single();

    if (serviceErr || !service) throw new AppError(404, "Service not found");

    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);

    await checkSlotCapacity(supabase, businessId, service_id, startDate, service);

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        business_id: businessId,
        service_id,
        customer_id,
        staff_id: staff_id || null,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        notes: notes || null,
        created_via: created_via || "web",
        status: (created_via === "manual" && status) ? status : "pending",
      })
      .select("*, services(name_he, name_ar, name_en), customers(name, phone)")
      .single();

    if (error) throw new AppError(400, error.message);

    if (data?.id) {
      await cacheClear(`appts:${businessId}:*`);
      sendAppointmentNotification(data.id, "booking_confirmation")
        .catch((err) => console.error("[Notification] booking_confirmation failed:", err));
      if (created_via !== "manual") {
        sendManagerNotification(data.id)
          .catch((err) => console.error("[Notification] manager failed:", err));
      }
      pushAppointmentToGoogle(data.id).catch(() => {});
    }

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
      const supabase = createServiceClient();
      const { status: newStatus } = req.body;
      const businessId = getBusinessId(req);
      const appointmentId = getParam(req, "appointmentId");

      const { data: appointment, error: fetchErr } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .single();

      if (fetchErr || !appointment) throw new AppError(404, "Appointment not found");

      const validation = validateTransition(appointment.status, newStatus);
      if (!validation.valid) throw new AppError(400, validation.error!);

      if (newStatus === "cancelled") {
        const { data: rules } = await supabase
          .from("booking_rules")
          .select("cancellation_window_minutes")
          .eq("business_id", businessId)
          .single();

        if (rules && req.userRole === "staff") {
          const cancelCheck = canCancel(
            new Date(appointment.start_time),
            rules.cancellation_window_minutes
          );
          if (!cancelCheck.allowed) throw new AppError(400, cancelCheck.error!);
        }
      }

      const { data, error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId)
        .select()
        .single();

      if (error) throw new AppError(400, error.message);

      if (data?.id) {
        await cacheClear(`appts:${businessId}:*`);
        const templateId = newStatus === "cancelled" ? "cancellation" : null;
        if (templateId) {
          sendAppointmentNotification(data.id, templateId)
            .catch((err) => console.error("[Notification] status change failed:", err));
        }
        pushAppointmentToGoogle(data.id).catch(() => {});
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /businesses/:businessId/appointments/:appointmentId/reschedule
router.patch(
  "/:appointmentId/reschedule",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const appointmentId = getParam(req, "appointmentId");
      const { start_time } = req.body;

      if (!start_time) throw new AppError(400, "start_time is required");

      const { data: apt } = await supabase
        .from("appointments")
        .select("id, status, service_id")
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .single();

      if (!apt) throw new AppError(404, "Appointment not found");
      if (["completed", "cancelled", "no_show"].includes(apt.status)) {
        throw new AppError(400, "Cannot reschedule an appointment with status: " + apt.status);
      }

      const { data: service, error: serviceErr } = await supabase
        .from("services")
        .select("duration_minutes, buffer_minutes, max_capacity")
        .eq("id", apt.service_id)
        .eq("business_id", businessId)
        .single();

      if (serviceErr || !service) throw new AppError(404, "Service not found");

      const startDate = new Date(start_time);
      const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);

      await checkSlotCapacity(supabase, businessId, apt.service_id, startDate, service, appointmentId);

      const { data, error } = await supabase
        .from("appointments")
        .update({ start_time: startDate.toISOString(), end_time: endDate.toISOString() })
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .select("*, services(name_he), customers(name, phone)")
        .single();

      if (error) throw new AppError(400, error.message);

      sendAppointmentNotification(appointmentId, "reschedule").catch((err) =>
        console.error("[reschedule] notification failed:", err)
      );

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/appointments/:appointmentId/approve
router.post(
  "/:appointmentId/approve",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const appointmentId = getParam(req, "appointmentId");

      const { data: target } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .single();
      if (!target) throw new AppError(404, "Appointment not found");

      const result = await approveAppointment(appointmentId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /businesses/:businessId/appointments/:appointmentId/reject
router.post(
  "/:appointmentId/reject",
  requireAuth,
  requireBusinessAccess,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const supabase = createServiceClient();
      const businessId = getBusinessId(req);
      const appointmentId = getParam(req, "appointmentId");

      const { data: target } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .single();
      if (!target) throw new AppError(404, "Appointment not found");

      const result = await rejectAppointment(appointmentId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
