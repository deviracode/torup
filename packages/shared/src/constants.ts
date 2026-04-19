export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const VALID_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const BOOKING_SOURCES = ["whatsapp", "web", "manual"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const MEMBER_ROLES = ["owner", "staff"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trial",
  "active",
  "past_due",
  "cancelled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BREAK_TYPES = ["recurring", "one_time"] as const;
export type BreakType = (typeof BREAK_TYPES)[number];

export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const SUPPORTED_LANGUAGES = ["he", "ar", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_BOOKING_RULES = {
  minAdvanceMinutes: 60,
  maxFutureDays: 30,
  cancellationWindowMinutes: 120,
  rescheduleWindowMinutes: 120,
} as const;

export const DEFAULT_SLOT_INTERVAL_MINUTES = 15;
