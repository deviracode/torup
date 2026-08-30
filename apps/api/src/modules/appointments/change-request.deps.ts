import { createServiceClient } from "../../lib/supabase";
import { createChangeRequestRepo } from "./change-request.repository";
import type { ChangeRequestDeps } from "./change-request.service";
import { sendChangeRequestOwnerNotification, sendChangeRequestResolutionNotification } from "../../services/notifications";
import { AppError } from "../../middleware/error-handler";

export function createChangeRequestDeps(): ChangeRequestDeps {
  const supabase = createServiceClient();

  return {
    changeRequestRepo: createChangeRequestRepo(supabase),

    async getBookingRules(businessId) {
      const { data, error } = await supabase
        .from("booking_rules")
        .select("cancellation_window_minutes, reschedule_window_minutes")
        .eq("business_id", businessId)
        .single();
      if (error) console.error(`Failed to fetch booking rules for business ${businessId}: ${error.message}`);
      return {
        cancellation_window_minutes: data?.cancellation_window_minutes ?? 120,
        reschedule_window_minutes: data?.reschedule_window_minutes ?? 120,
      };
    },

    async getAppointment(appointmentId) {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, business_id, service_id, status, start_time")
        .eq("id", appointmentId)
        .single();
      if (error || !data) throw new AppError(404, `Appointment ${appointmentId} not found`);
      return data;
    },

    async checkCapacity(appointmentId, proposedStartTime) {
      const { data: apt, error: aptError } = await supabase
        .from("appointments")
        .select("business_id, service_id, services(duration_minutes, buffer_minutes, max_capacity)")
        .eq("id", appointmentId)
        .single();
      if (aptError) console.error(`Failed to fetch appointment ${appointmentId} for capacity check: ${aptError.message}`);
      if (!apt) return false;
      const service = apt.services as unknown as { duration_minutes: number; buffer_minutes: number; max_capacity: number };
      const startDate = new Date(proposedStartTime);
      const endWithBuffer = new Date(startDate.getTime() + (service.duration_minutes + service.buffer_minutes) * 60_000);

      const { data: overlapping, error: overlapError } = await supabase
        .from("appointments")
        .select("id")
        .eq("business_id", apt.business_id)
        .eq("service_id", apt.service_id)
        .neq("id", appointmentId)
        .not("status", "in", "(cancelled,no_show)")
        .lt("start_time", endWithBuffer.toISOString())
        .gt("end_time", startDate.toISOString());
      if (overlapError) console.error(`Failed to fetch overlapping appointments for ${appointmentId}: ${overlapError.message}`);

      return (overlapping?.length ?? 0) < service.max_capacity;
    },

    async updateAppointmentTime(appointmentId, newStartTime) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("service_id, services(duration_minutes)")
        .eq("id", appointmentId)
        .single();
      const durationMinutes = (apt?.services as unknown as { duration_minutes: number } | undefined)?.duration_minutes ?? 60;
      const endTime = new Date(new Date(newStartTime).getTime() + durationMinutes * 60_000).toISOString();
      const { error } = await supabase
        .from("appointments")
        .update({ start_time: newStartTime, end_time: endTime })
        .eq("id", appointmentId);
      if (error) throw new Error(`Failed to update appointment ${appointmentId} time: ${error.message}`);
    },

    async cancelAppointment(appointmentId) {
      const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);
      if (error) throw new Error(`Failed to cancel appointment ${appointmentId}: ${error.message}`);
    },

    notifyOwnerOfNewRequest: sendChangeRequestOwnerNotification,
    notifyCustomerOfResolution: sendChangeRequestResolutionNotification,
  };
}
