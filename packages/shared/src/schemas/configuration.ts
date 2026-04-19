import { z } from "zod";
import { BREAK_TYPES, DAYS_OF_WEEK } from "../constants.js";

export const workingHoursSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  is_closed: z.boolean().default(false),
});

export const breakSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable(),
  type: z.enum(BREAK_TYPES),
  day_of_week: z.number().int().min(0).max(6).nullable(),
  specific_date: z.string().nullable(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().max(200).nullable(),
});

export const bookingRulesSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  min_advance_minutes: z.number().int().min(0).default(60),
  max_future_days: z.number().int().min(1).max(365).default(30),
  cancellation_window_minutes: z.number().int().min(0).default(120),
  reschedule_window_minutes: z.number().int().min(0).default(120),
});

export type WorkingHours = z.infer<typeof workingHoursSchema>;
export type Break = z.infer<typeof breakSchema>;
export type BookingRules = z.infer<typeof bookingRulesSchema>;
