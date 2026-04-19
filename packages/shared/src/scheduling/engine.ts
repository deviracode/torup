import type {
  TimeRange,
  WorkingDay,
  BreakPeriod,
  ExistingAppointment,
  ServiceConfig,
  BookingRulesConfig,
  TimeSlot,
  SlotSuggestion,
} from "./types.js";
import { DEFAULT_SLOT_INTERVAL_MINUTES } from "../constants.js";

/**
 * Parse "HH:mm" string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convert minutes since midnight to "HH:mm"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Create a Date object for a specific date and time
 */
function createDateTime(dateStr: string, timeMinutes: number): Date {
  const date = new Date(dateStr + "T00:00:00");
  date.setMinutes(timeMinutes);
  return date;
}

/**
 * Get the day of week (0=Sunday) for a date string
 */
function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay();
}

/**
 * Get working time ranges for a specific date, accounting for breaks
 */
export function getWorkableRanges(
  dateStr: string,
  workingHours: WorkingDay[],
  breaks: BreakPeriod[]
): TimeRange[] {
  const dayOfWeek = getDayOfWeek(dateStr);
  const day = workingHours.find((wh) => wh.dayOfWeek === dayOfWeek);

  if (!day || day.isClosed || day.ranges.length === 0) {
    return [];
  }

  // Collect breaks applicable to this date
  const applicableBreaks = breaks.filter((b) => {
    if (b.type === "recurring" && b.dayOfWeek === dayOfWeek) return true;
    if (b.type === "one_time" && b.specificDate === dateStr) return true;
    return false;
  });

  // Check if it's a full-day holiday
  const fullDayHoliday = applicableBreaks.some(
    (b) => b.type === "one_time" && b.start === "00:00" && b.end === "23:59"
  );
  if (fullDayHoliday) return [];

  // Subtract break periods from working ranges
  let ranges = [...day.ranges];

  for (const brk of applicableBreaks) {
    const breakStart = timeToMinutes(brk.start);
    const breakEnd = timeToMinutes(brk.end);
    const newRanges: TimeRange[] = [];

    for (const range of ranges) {
      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);

      // No overlap
      if (breakEnd <= rangeStart || breakStart >= rangeEnd) {
        newRanges.push(range);
        continue;
      }

      // Before break
      if (rangeStart < breakStart) {
        newRanges.push({ start: range.start, end: minutesToTime(breakStart) });
      }
      // After break
      if (rangeEnd > breakEnd) {
        newRanges.push({ start: minutesToTime(breakEnd), end: range.end });
      }
    }

    ranges = newRanges;
  }

  return ranges;
}

/**
 * Count how many appointments overlap with a given time window
 */
export function countOverlapping(
  slotStart: Date,
  slotEnd: Date,
  appointments: ExistingAppointment[]
): number {
  return appointments.filter((apt) => {
    return apt.startTime < slotEnd && apt.endTime > slotStart;
  }).length;
}

/**
 * Check if a slot conflicts (would exceed capacity)
 */
export function checkConflict(
  slotStart: Date,
  slotEnd: Date,
  appointments: ExistingAppointment[],
  maxCapacity: number
): boolean {
  const overlapping = countOverlapping(slotStart, slotEnd, appointments);
  return overlapping >= maxCapacity;
}

/**
 * Core: get available time slots for a date
 */
export function getAvailableSlots(
  dateStr: string,
  service: ServiceConfig,
  workingHours: WorkingDay[],
  breaks: BreakPeriod[],
  existingAppointments: ExistingAppointment[],
  bookingRules?: BookingRulesConfig,
  intervalMinutes: number = DEFAULT_SLOT_INTERVAL_MINUTES
): TimeSlot[] {
  const workableRanges = getWorkableRanges(dateStr, workingHours, breaks);
  if (workableRanges.length === 0) return [];

  const slotDuration = service.durationMinutes + service.bufferMinutes;
  const now = new Date();
  const slots: TimeSlot[] = [];

  for (const range of workableRanges) {
    const rangeStartMin = timeToMinutes(range.start);
    const rangeEndMin = timeToMinutes(range.end);

    for (
      let startMin = rangeStartMin;
      startMin + service.durationMinutes <= rangeEndMin;
      startMin += intervalMinutes
    ) {
      const slotStart = createDateTime(dateStr, startMin);
      const slotEnd = createDateTime(dateStr, startMin + service.durationMinutes);
      const slotEndWithBuffer = createDateTime(dateStr, startMin + slotDuration);

      // Skip slots in the past
      if (slotStart <= now) continue;

      // Enforce minimum advance booking
      if (bookingRules) {
        const minAdvanceTime = new Date(
          now.getTime() + bookingRules.minAdvanceMinutes * 60 * 1000
        );
        if (slotStart < minAdvanceTime) continue;
      }

      // Count overlapping appointments (using slot with buffer for conflict check)
      const overlapping = countOverlapping(
        slotStart,
        slotEndWithBuffer,
        existingAppointments
      );

      const availableCapacity = service.maxCapacity - overlapping;

      if (availableCapacity > 0) {
        slots.push({
          start: slotStart,
          end: slotEnd,
          availableCapacity,
          totalCapacity: service.maxCapacity,
        });
      }
    }
  }

  return slots;
}

/**
 * Smart slot suggestions: find nearest available slots to requested time
 */
export function getSuggestedSlots(
  requestedDateStr: string,
  requestedTimeMinutes: number,
  service: ServiceConfig,
  workingHours: WorkingDay[],
  breaks: BreakPeriod[],
  existingAppointments: ExistingAppointment[],
  bookingRules?: BookingRulesConfig,
  maxSuggestions: number = 5,
  maxDaysToSearch: number = 7
): SlotSuggestion[] {
  const suggestions: SlotSuggestion[] = [];
  const requestedTime = createDateTime(requestedDateStr, requestedTimeMinutes);

  for (let dayOffset = 0; dayOffset < maxDaysToSearch; dayOffset++) {
    const date = new Date(requestedDateStr + "T12:00:00");
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split("T")[0];

    const slots = getAvailableSlots(
      dateStr,
      service,
      workingHours,
      breaks,
      existingAppointments,
      bookingRules
    );

    for (const slot of slots) {
      const distanceMinutes = Math.abs(
        (slot.start.getTime() - requestedTime.getTime()) / (1000 * 60)
      );

      suggestions.push({
        slot,
        date: dateStr,
        distanceMinutes,
      });
    }

    if (suggestions.length >= maxSuggestions * 3) break;
  }

  // Sort by distance from requested time
  suggestions.sort((a, b) => a.distanceMinutes - b.distanceMinutes);

  return suggestions.slice(0, maxSuggestions);
}
