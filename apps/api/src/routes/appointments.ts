import { Router, type Router as RouterType, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId, getParam } from "../lib/params.js";
import {
  requireAuth,
  requireBusinessAccess,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { AppError } from "../middleware/error-handler.js";
import { validateTransition, canCancel } from "@queue/shared";
import { sendAppointmentNotification } from "../services/notifications.js";

const router: RouterType = Router({ mergeParams: true });

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
        query = query
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd);
      }
      if (status) query = query.eq("status", status as string);
      if (staffId) query = query.eq("staff_id", staffId as string);

      const { data, error } = await query;
      if (error) throw new AppError(500, error.message);
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
    const { service_id, customer_id, staff_id, start_time, notes, created_via } = req.body;

    const { data: service, error: serviceErr } = await supabase
      .from("services")
      .select("duration_minutes, buffer_minutes, max_capacity")
      .eq("id", service_id)
      .eq("business_id", businessId)
      .single();

    if (serviceErr || !service) throw new AppError(404, "Service not found");

    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);
    const endWithBuffer = new Date(endDate.getTime() + service.buffer_minutes * 60 * 1000);

    const { data: overlapping } = await supabase
      .from("appointments")
      .select("id")
      .eq("business_id", businessId)
      .eq("service_id", service_id)
      .lt("start_time", endWithBuffer.toISOString())
      .gt("end_time", startDate.toISOString())
      .not("status", "in", '("cancelled","no_show")');

    if (overlapping && overlapping.length >= service.max_capacity) {
      throw new AppError(409, "Time slot is fully booked");
    }

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
        status: "pending",
      })
      .select("*, services(name_he, name_ar, name_en), customers(name, phone)")
      .single();

    if (error) throw new AppError(400, error.message);

    // Send booking confirmation notification (fire and forget)
    if (data?.id) {
      sendAppointmentNotification(data.id, "booking_confirmation").catch(() => {});
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

      // Send notification for status change (fire and forget)
      if (data?.id) {
        const templateId = newStatus === "cancelled" ? "cancellation" : null;
        if (templateId) {
          sendAppointmentNotification(data.id, templateId).catch(() => {});
        }
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
