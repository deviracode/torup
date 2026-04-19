export interface TimeRange {
  start: string; // "HH:mm" format
  end: string;
}

export interface WorkingDay {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  ranges: TimeRange[];
  isClosed: boolean;
}

export interface BreakPeriod {
  type: "recurring" | "one_time";
  dayOfWeek?: number;
  specificDate?: string; // "YYYY-MM-DD"
  start: string; // "HH:mm"
  end: string;
}

export interface ExistingAppointment {
  startTime: Date;
  endTime: Date;
  staffId?: string | null;
}

export interface ServiceConfig {
  durationMinutes: number;
  bufferMinutes: number;
  maxCapacity: number;
}

export interface BookingRulesConfig {
  minAdvanceMinutes: number;
  maxFutureDays: number;
  cancellationWindowMinutes: number;
  rescheduleWindowMinutes: number;
}

export interface StaffAvailability {
  staffId: string;
  workingHours: WorkingDay[];
  breaks: BreakPeriod[];
  assignedServiceIds: string[];
}

export interface TimeSlot {
  start: Date;
  end: Date;
  availableCapacity: number;
  totalCapacity: number;
}

export interface SlotSuggestion {
  slot: TimeSlot;
  date: string; // "YYYY-MM-DD"
  distanceMinutes: number; // distance from requested time
}
