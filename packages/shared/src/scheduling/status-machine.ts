import {
  VALID_STATUS_TRANSITIONS,
  type AppointmentStatus,
} from "../constants.js";

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): boolean {
  const validTargets = VALID_STATUS_TRANSITIONS[from];
  return validTargets.includes(to);
}

export function validateTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): { valid: boolean; error?: string } {
  if (from === to) {
    return { valid: false, error: `Appointment is already ${from}` };
  }

  if (!canTransition(from, to)) {
    const validTargets = VALID_STATUS_TRANSITIONS[from];
    if (validTargets.length === 0) {
      return {
        valid: false,
        error: `Cannot change status of a ${from} appointment`,
      };
    }
    return {
      valid: false,
      error: `Cannot transition from ${from} to ${to}. Valid transitions: ${validTargets.join(", ")}`,
    };
  }

  return { valid: true };
}

export function canCancel(
  appointmentStartTime: Date,
  cancellationWindowMinutes: number
): { allowed: boolean; error?: string } {
  const now = new Date();
  const windowStart = new Date(
    appointmentStartTime.getTime() - cancellationWindowMinutes * 60 * 1000
  );

  if (now > windowStart) {
    return {
      allowed: false,
      error: `Cancellation window has passed. Must cancel at least ${cancellationWindowMinutes} minutes before the appointment.`,
    };
  }

  return { allowed: true };
}

export function canReschedule(
  appointmentStartTime: Date,
  rescheduleWindowMinutes: number
): { allowed: boolean; error?: string } {
  const now = new Date();
  const windowStart = new Date(
    appointmentStartTime.getTime() - rescheduleWindowMinutes * 60 * 1000
  );

  if (now > windowStart) {
    return {
      allowed: false,
      error: `Reschedule window has passed. Must reschedule at least ${rescheduleWindowMinutes} minutes before the appointment.`,
    };
  }

  return { allowed: true };
}
