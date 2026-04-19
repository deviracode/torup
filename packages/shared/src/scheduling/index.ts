export {
  getAvailableSlots,
  getSuggestedSlots,
  getWorkableRanges,
  checkConflict,
  countOverlapping,
  timeToMinutes,
  minutesToTime,
} from "./engine.js";

export {
  canTransition,
  validateTransition,
  canCancel,
  canReschedule,
} from "./status-machine.js";

export type {
  TimeRange,
  WorkingDay,
  BreakPeriod,
  ExistingAppointment,
  ServiceConfig,
  BookingRulesConfig,
  StaffAvailability,
  TimeSlot,
  SlotSuggestion,
} from "./types.js";
