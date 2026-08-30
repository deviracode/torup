import { AppError } from "../../middleware/error-handler";
import type { createChangeRequestRepo, ChangeRequestType } from "./change-request.repository";

type ChangeRequestRepo = ReturnType<typeof createChangeRequestRepo>;

interface BookingRules {
  cancellation_window_minutes: number;
  reschedule_window_minutes: number;
}

interface AppointmentForGating {
  id: string;
  business_id: string;
  service_id?: string;
  status: string;
  start_time: string;
}

export interface ChangeRequestDeps {
  changeRequestRepo: ChangeRequestRepo;
  getBookingRules: (businessId: string) => Promise<BookingRules>;
  getAppointment: (appointmentId: string) => Promise<AppointmentForGating>;
  checkCapacity: (appointmentId: string, proposedStartTime: string) => Promise<boolean>;
  updateAppointmentTime: (appointmentId: string, newStartTime: string) => Promise<void>;
  cancelAppointment: (appointmentId: string) => Promise<void>;
  notifyOwnerOfNewRequest: (requestId: string) => Promise<void>;
  notifyCustomerOfResolution: (requestId: string, resolution: "approved" | "rejected") => Promise<void>;
}

function minutesUntil(isoTime: string): number {
  return (new Date(isoTime).getTime() - Date.now()) / 60_000;
}

export function createChangeRequestService(deps: ChangeRequestDeps) {
  async function create(
    appointmentId: string,
    input: { type: ChangeRequestType; proposedStartTime?: string; reason?: string }
  ) {
    const { data: existing } = await deps.changeRequestRepo.findPendingByAppointment(appointmentId);
    if (existing) throw new AppError(409, "You already have a pending request for this appointment");

    const apt = await deps.getAppointment(appointmentId);
    const rules = await deps.getBookingRules(apt.business_id);
    const windowMinutes = input.type === "cancel" ? rules.cancellation_window_minutes : rules.reschedule_window_minutes;
    if (minutesUntil(apt.start_time) < windowMinutes) {
      throw new AppError(400, "Too close to the appointment time to request this change");
    }

    const { data, error } = await deps.changeRequestRepo.create({
      appointment_id: appointmentId,
      business_id: apt.business_id,
      type: input.type,
      proposed_start_time: input.proposedStartTime ?? null,
      reason: input.reason ?? null,
    });
    if (error || !data) throw new AppError(500, "Failed to create change request");

    await deps.notifyOwnerOfNewRequest(data.id);
    return data;
  }

  async function loadPendingRequest(businessId: string, requestId: string) {
    const { data, error } = await deps.changeRequestRepo.findByIdAndBusiness(requestId, businessId);
    if (error || !data) throw new AppError(404, "Change request not found");
    if (data.status !== "pending") throw new AppError(409, "This request has already been resolved");
    return data;
  }

  async function approve(businessId: string, requestId: string, resolvedBy: string) {
    const request = await loadPendingRequest(businessId, requestId);
    const apt = await deps.getAppointment(request.appointment_id);

    if (request.type === "edit") {
      if (!request.proposed_start_time) throw new AppError(400, "Edit request has no proposed time");
      const available = await deps.checkCapacity(request.appointment_id, request.proposed_start_time);
      if (!available) throw new AppError(409, "The proposed slot is no longer available");
      await deps.updateAppointmentTime(request.appointment_id, request.proposed_start_time);
    } else {
      if (apt.status === "cancelled" || apt.status === "completed" || apt.status === "no_show") {
        throw new AppError(409, "Appointment is no longer in a cancellable state");
      }
      await deps.cancelAppointment(request.appointment_id);
    }

    await deps.changeRequestRepo.updateStatus(requestId, "approved", resolvedBy);
    await deps.notifyCustomerOfResolution(requestId, "approved");
    return { status: "approved" as const };
  }

  async function reject(businessId: string, requestId: string, resolvedBy: string) {
    await loadPendingRequest(businessId, requestId);
    await deps.changeRequestRepo.updateStatus(requestId, "rejected", resolvedBy);
    await deps.notifyCustomerOfResolution(requestId, "rejected");
    return { status: "rejected" as const };
  }

  return { create, approve, reject };
}
