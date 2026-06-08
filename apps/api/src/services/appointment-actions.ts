import { createServiceClient } from "../lib/supabase.js";
import { AppError } from "../middleware/error-handler.js";
import { pushAppointmentToGoogle } from "./google-calendar.js";
import { sendApprovalNotification, sendRejectionNotification } from "./notifications.js";
import { cacheClear } from "../lib/redis.js";

// Approve a pending_approval appointment and reject any overlapping siblings.
export async function approveAppointment(appointmentId: string) {
  const supabase = createServiceClient();

  const { data: target, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, business_id, status, start_time, end_time")
    .eq("id", appointmentId)
    .single();

  if (fetchErr || !target) throw new AppError(404, "Appointment not found");
  if (target.status !== "pending_approval") {
    throw new AppError(409, `Cannot approve an appointment with status '${target.status}'`);
  }

  const businessId = target.business_id;

  const { error: updErr } = await supabase
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", appointmentId);
  if (updErr) throw new AppError(400, updErr.message);

  // Reject overlapping pending_approval siblings (overlap = start < target.end AND end > target.start).
  const { data: overlapping, error: ovErr } = await supabase
    .from("appointments")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "pending_approval")
    .neq("id", appointmentId)
    .lt("start_time", target.end_time)
    .gt("end_time", target.start_time);
  if (ovErr) throw new AppError(400, ovErr.message);

  const rejectedIds = (overlapping || []).map((r) => r.id);
  if (rejectedIds.length > 0) {
    const { error: rejErr } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .in("id", rejectedIds);
    if (rejErr) throw new AppError(400, rejErr.message);
  }

  await cacheClear(`appts:${businessId}:*`);
  sendApprovalNotification(appointmentId)
    .catch((err) => console.error("[Notification] approval failed:", err));
  pushAppointmentToGoogle(appointmentId).catch(() => {});
  for (const id of rejectedIds) {
    sendRejectionNotification(id, "slot_taken")
      .catch((err) => console.error("[Notification] slot_taken rejection failed:", err));
    pushAppointmentToGoogle(id).catch(() => {});
  }

  return { approved: appointmentId, rejected: rejectedIds };
}

// Reject (cancel) a pending_approval appointment.
export async function rejectAppointment(appointmentId: string) {
  const supabase = createServiceClient();

  const { data: target, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, business_id, status")
    .eq("id", appointmentId)
    .single();
  if (fetchErr || !target) throw new AppError(404, "Appointment not found");
  if (target.status !== "pending_approval") {
    throw new AppError(409, `Cannot reject an appointment with status '${target.status}'`);
  }

  const businessId = target.business_id;

  const { error: updErr } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);
  if (updErr) throw new AppError(400, updErr.message);

  await cacheClear(`appts:${businessId}:*`);
  sendRejectionNotification(appointmentId, "manual")
    .catch((err) => console.error("[Notification] manual rejection failed:", err));
  pushAppointmentToGoogle(appointmentId).catch(() => {});

  return { rejected: appointmentId };
}
