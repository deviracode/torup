import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from "express";
import { createServiceClient } from "../lib/supabase.js";
import { getBusinessId } from "../lib/params.js";
import { AppError } from "../middleware/error-handler.js";
import {
  getAvailableSlots,
  type WorkingDay,
  type BreakPeriod,
  type ExistingAppointment,
  type ServiceConfig,
  type BookingRulesConfig,
} from "@queue/shared";

const router: RouterType = Router({ mergeParams: true });

// GET /businesses/:businessId/availability?service_id=&date=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createServiceClient();
    const businessId = getBusinessId(req);
    const { service_id, date } = req.query;

    if (!service_id || !date) throw new AppError(400, "service_id and date are required");

    const dateStr = date as string;

    const { data: service } = await supabase
      .from("services")
      .select("*")
      .eq("id", service_id as string)
      .eq("business_id", businessId)
      .eq("is_active", true)
      .single();

    if (!service) throw new AppError(404, "Service not found");

    const [whResult, brResult, aptResult, rulesResult] = await Promise.all([
      supabase.from("working_hours").select("*").eq("business_id", businessId).is("staff_id", null),
      supabase.from("breaks").select("*").eq("business_id", businessId).is("staff_id", null),
      supabase
        .from("appointments")
        .select("start_time, end_time, staff_id")
        .eq("business_id", businessId)
        .eq("service_id", service_id as string)
        .gte("start_time", `${dateStr}T00:00:00+03:00`)
        .lte("start_time", `${dateStr}T23:59:59+03:00`)
        .not("status", "in", '("cancelled","no_show")'),
      supabase.from("booking_rules").select("*").eq("business_id", businessId).single(),
    ]);

    // Transform working hours
    const whMap = new Map<number, { start: string; end: string }[]>();
    for (const wh of whResult.data || []) {
      if (!whMap.has(wh.day_of_week)) whMap.set(wh.day_of_week, []);
      if (!wh.is_closed) whMap.get(wh.day_of_week)!.push({ start: wh.start_time, end: wh.end_time });
    }

    const workingHours: WorkingDay[] = Array.from({ length: 7 }, (_, day) => {
      const ranges = whMap.get(day) || [];
      const isClosed = ranges.length === 0 || (whResult.data || []).some(
        (wh: Record<string, unknown>) => wh.day_of_week === day && wh.is_closed
      );
      return { dayOfWeek: day, ranges, isClosed };
    });

    const breaks: BreakPeriod[] = (brResult.data || []).map((b: Record<string, unknown>) => ({
      type: b.type as "recurring" | "one_time",
      dayOfWeek: (b.day_of_week as number) ?? undefined,
      specificDate: (b.specific_date as string) ?? undefined,
      start: b.start_time as string,
      end: b.end_time as string,
    }));

    const existingAppointments: ExistingAppointment[] = (aptResult.data || []).map(
      (a: Record<string, unknown>) => ({
        startTime: new Date(a.start_time as string),
        endTime: new Date(a.end_time as string),
        staffId: a.staff_id as string | null,
      })
    );

    const serviceConfig: ServiceConfig = {
      durationMinutes: service.duration_minutes,
      bufferMinutes: service.buffer_minutes,
      maxCapacity: service.max_capacity,
    };

    const bookingRules: BookingRulesConfig | undefined = rulesResult.data
      ? {
          minAdvanceMinutes: rulesResult.data.min_advance_minutes,
          maxFutureDays: rulesResult.data.max_future_days,
          cancellationWindowMinutes: rulesResult.data.cancellation_window_minutes,
          rescheduleWindowMinutes: rulesResult.data.reschedule_window_minutes,
        }
      : undefined;

    const slots = getAvailableSlots(
      dateStr,
      serviceConfig,
      workingHours,
      breaks,
      existingAppointments,
      bookingRules,
      service.duration_minutes + service.buffer_minutes
    );

    res.json({
      date: dateStr,
      service_id: service.id,
      service_name: service.name_he,
      duration_minutes: service.duration_minutes,
      slots: slots.map((s: { start: Date; end: Date; availableCapacity: number; totalCapacity: number }) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        available_capacity: s.availableCapacity,
        total_capacity: s.totalCapacity,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
