import { getAvailableSlots, type WorkingDay, type BreakPeriod, type ExistingAppointment, type ServiceConfig, type BookingRulesConfig } from "@torup/shared";
import { AppError } from "../../middleware/error-handler";
import { type createAvailabilityRepo } from "./availability.repository";

type Repo = ReturnType<typeof createAvailabilityRepo>;

function getILOffset(d: string): { hours: number; str: string } {
  const ref = new Date(`${d}T12:00:00Z`);
  const utcH = ref.getUTCHours();
  const ilH = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour: "numeric", hour12: false }).format(ref));
  let diff = ilH - utcH; if (diff < 0) diff += 24; if (diff > 12) diff -= 24;
  return { hours: diff, str: `+${String(diff).padStart(2, "0")}:00` };
}
function toUTCTime(localTime: string, ilOff: number): string {
  const [h, m] = localTime.split(":").map(Number);
  const utcMin = h * 60 + m - ilOff * 60;
  const uh = Math.floor(utcMin / 60), um = utcMin % 60;
  return `${String(Math.max(0, Math.min(23, uh))).padStart(2, "0")}:${String(Math.max(0, um)).padStart(2, "0")}`;
}

export function createAvailabilityService(repo: Repo) {
  return {
    async get(businessId: string, serviceId: string, dateStr: string) {
      const il = getILOffset(dateStr), tz = il.str;
      const { data: service } = await repo.findService(serviceId, businessId);
      if (!service) throw new AppError(404, "Service not found");

      const [whR, brR, aptR, rulesR, ssR, sbR] = await Promise.all([
        repo.findWorkingHours(businessId), repo.findBreaks(businessId),
        repo.findAppointmentsForDay(businessId, serviceId, dateStr, tz),
        repo.findBookingRules(businessId), repo.findStaffServices(serviceId),
        repo.findStaffOffToday(businessId, dateStr),
      ]);

      const whMap = new Map<number, { start: string; end: string }[]>();
      for (const wh of whR.data || []) { if (!whMap.has(wh.day_of_week)) whMap.set(wh.day_of_week, []); if (!wh.is_closed) whMap.get(wh.day_of_week)!.push({ start: toUTCTime(wh.start_time, il.hours), end: toUTCTime(wh.end_time, il.hours) }); }
      const workingHours: WorkingDay[] = Array.from({ length: 7 }, (_, day) => { const ranges = whMap.get(day) || []; return { dayOfWeek: day, ranges, isClosed: ranges.length === 0 || (whR.data || []).some((wh) => wh.day_of_week === day && wh.is_closed) }; });
      const breaks: BreakPeriod[] = (brR.data || []).map((b) => ({ type: b.type as BreakPeriod["type"], dayOfWeek: b.day_of_week ?? undefined, specificDate: b.specific_date ?? undefined, start: toUTCTime(b.start_time, il.hours), end: toUTCTime(b.end_time, il.hours) }));
      const existing: ExistingAppointment[] = (aptR.data || []).map((a) => ({ startTime: new Date(a.start_time), endTime: new Date(a.end_time), staffId: a.staff_id }));
      const assigned = (ssR.data || []).map((r) => r.staff_id);
      const offToday = new Set((sbR.data || []).map((r) => r.staff_id));
      const availStaff = assigned.length > 0 ? assigned.filter((id) => !offToday.has(id)).length : null;

      const svcCfg: ServiceConfig = { durationMinutes: service.duration_minutes, bufferMinutes: service.buffer_minutes, maxCapacity: availStaff ?? service.max_capacity };
      const rules: BookingRulesConfig | undefined = rulesR.data ? { minAdvanceMinutes: rulesR.data.min_advance_minutes, maxFutureDays: rulesR.data.max_future_days, cancellationWindowMinutes: rulesR.data.cancellation_window_minutes, rescheduleWindowMinutes: rulesR.data.reschedule_window_minutes } : undefined;

      const slots = getAvailableSlots(dateStr, svcCfg, workingHours, breaks, existing, rules, service.duration_minutes + service.buffer_minutes);
      return { date: dateStr, service_id: service.id, service_name: service.name_he, duration_minutes: service.duration_minutes, slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), available_capacity: s.availableCapacity, total_capacity: s.totalCapacity })) };
    },
  };
}
