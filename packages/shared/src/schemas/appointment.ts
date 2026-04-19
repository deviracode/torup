import { z } from "zod";
import { APPOINTMENT_STATUSES, BOOKING_SOURCES } from "../constants.js";

export const appointmentSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  service_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  status: z.enum(APPOINTMENT_STATUSES),
  notes: z.string().max(1000).nullable(),
  created_via: z.enum(BOOKING_SOURCES),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createAppointmentSchema = z.object({
  service_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  staff_id: z.string().uuid().nullable().optional(),
  start_time: z.string().datetime(),
  notes: z.string().max(1000).nullable().optional(),
  created_via: z.enum(BOOKING_SOURCES),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
});

export type Appointment = z.infer<typeof appointmentSchema>;
export type CreateAppointment = z.infer<typeof createAppointmentSchema>;
