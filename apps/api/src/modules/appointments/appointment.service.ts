import { validateTransition, canCancel, type AppointmentStatus } from "@torup/shared";
import type { Enums } from "@torup/db";
import { AppError } from "../../middleware/error-handler";
import { type createAppointmentRepo } from "./appointment.repository";

type AppointmentRepo = ReturnType<typeof createAppointmentRepo>;

export interface AppointmentDeps {
  cache: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttl: number) => Promise<void>;
    clear: (pattern: string) => Promise<void>;
  };
  notify: {
    sendAppointment: (
      appointmentId: string,
      templateId: string,
      extraVars?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => Promise<unknown>;
    sendManager: (appointmentId: string) => Promise<unknown>;
    sendApproval: (
      appointmentId: string
    ) => Promise<{ sent: boolean; failed: boolean } | undefined | void>;
    sendRejection: (
      appointmentId: string,
      reason: string
    ) => Promise<{ sent: boolean; failed: boolean } | undefined | void>;
  };
  gcal: {
    pushAppointment: (appointmentId: string) => Promise<void>;
  };
}

function toILDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

export function createAppointmentService(repo: AppointmentRepo, deps: AppointmentDeps) {
  async function checkSlotCapacity(
    businessId: string,
    serviceId: string,
    startDate: Date,
    service: { duration_minutes: number; buffer_minutes: number; max_capacity: number },
    excludeAppointmentId?: string
  ): Promise<void> {
    const endWithBuffer = new Date(
      startDate.getTime() +
        service.duration_minutes * 60 * 1000 +
        service.buffer_minutes * 60 * 1000
    );

    // Capacity should reflect how many staff can actually perform this
    // service, not a static max_capacity column — matches the same
    // staff-based capacity model used by the read-side availability
    // endpoint, so booking never rejects (or accepts) a slot the customer
    // was just shown as (un)available.
    const [ssR, sbR] = await Promise.all([
      repo.findStaffServices(serviceId),
      repo.findStaffOffToday(businessId, toILDateStr(startDate)),
    ]);
    const offToday = new Set((sbR.data || []).map((r) => r.staff_id));
    const staffIds = (ssR.data || []).map((r) => r.staff_id);
    const availStaff = staffIds.length > 0 ? staffIds.filter((id) => !offToday.has(id)) : [];
    const maxCapacity = staffIds.length > 0 ? availStaff.length : service.max_capacity;

    const { data: overlapping } = (await repo.findOverlapping(
      businessId,
      serviceId,
      startDate.toISOString(),
      endWithBuffer.toISOString(),
      excludeAppointmentId,
      staffIds
    )) as {
      data: { id: string }[] | null;
      error: import("@supabase/supabase-js").PostgrestError | null;
    };

    if (overlapping && overlapping.length >= maxCapacity) {
      throw new AppError(409, "Time slot is fully booked");
    }
  }

  return {
    async list(businessId: string, filters?: { date?: string; status?: string; staffId?: string }) {
      const cacheKey = `appts:${businessId}:${filters?.date ?? "all"}:${filters?.status ?? "all"}:${filters?.staffId ?? "all"}`;
      const cached = await deps.cache.get(cacheKey);
      if (cached) return { data: JSON.parse(cached), cache: "HIT" as const };

      const { data, error } = await repo.findByDate(businessId, filters);
      if (error) throw new AppError(500, error.message);

      await deps.cache.set(cacheKey, JSON.stringify(data), 30);
      return { data, cache: "MISS" as const };
    },

    async book(
      businessId: string,
      input: {
        service_id: string;
        customer_id: string;
        staff_id?: string | null;
        start_time: string;
        notes?: string | null;
        created_via?: string;
        status?: string;
      }
    ) {
      const { service_id, customer_id, staff_id, start_time, notes, created_via, status } = input;

      const { data: serviceRow, error: serviceErr } = (await repo.findServiceById(
        businessId,
        service_id
      )) as {
        data: { duration_minutes: number; buffer_minutes: number; max_capacity: number } | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };
      if (serviceErr || !serviceRow) throw new AppError(404, "Service not found");

      const service = serviceRow as {
        duration_minutes: number;
        buffer_minutes: number;
        max_capacity: number;
      };

      const startDate = new Date(start_time);
      const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);

      await checkSlotCapacity(businessId, service_id, startDate, service);

      const isManual = created_via === "manual";
      // Public bookings (web, or any non-manual source) always land as
      // pending_approval, same as WhatsApp bookings — a manager must approve
      // before the appointment is actually confirmed. Only manual/staff-
      // created appointments (dashboard) skip this gate.
      const finalStatus = isManual ? status || "pending" : "pending_approval";

      const { data, error } = await repo.create({
        business_id: businessId,
        service_id,
        customer_id,
        staff_id: staff_id || null,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        notes: notes || null,
        created_via: (created_via || "web") as Enums<"booking_source">,
        status: finalStatus as Enums<"appointment_status">,
      });

      if (error) throw new AppError(400, error.message);

      if (data?.id) {
        await deps.cache.clear(`appts:${businessId}:*`);
        if (!isManual) {
          deps.notify
            .sendAppointment(data.id, "booking_pending_approval")
            .catch((err) => console.error("[Notification] booking_pending_approval failed:", err));
          deps.notify
            .sendManager(data.id)
            .catch((err) => console.error("[Notification] manager failed:", err));
        } else if (finalStatus === "confirmed") {
          // Manual bookings confirmed directly (e.g. staff-entered phone
          // bookings) never had a WhatsApp session opened by the customer,
          // so a freeform "booking_confirmation" text silently fails Meta's
          // 24h re-engagement-window check. sendApproval uses the same
          // Meta-approved appointment_confirmed_he/ar template as the
          // staff-approval flow (gated behind WHATSAPP_APPROVAL_TEMPLATE_ENABLED,
          // falling back to freeform only if that's unset).
          deps.notify
            .sendApproval(data.id)
            .catch((err) => console.error("[Notification] booking_confirmation (approval template) failed:", err));
        }
        deps.gcal
          .pushAppointment(data.id)
          .catch((err) => console.error("[gcal] pushAppointment failed:", err));
      }

      return data;
    },

    async changeStatus(
      businessId: string,
      appointmentId: string,
      newStatus: string,
      userRole: string
    ) {
      const { data: appointment, error: fetchErr } = (await repo.findById(
        appointmentId,
        businessId
      )) as {
        data: {
          id: string;
          status: string;
          start_time: string;
          business_id: string;
          [key: string]: unknown;
        } | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };

      if (fetchErr || !appointment) throw new AppError(404, "Appointment not found");

      const validation = validateTransition(
        appointment.status as AppointmentStatus,
        newStatus as AppointmentStatus
      );
      if (!validation.valid) throw new AppError(400, validation.error!);

      if (newStatus === "cancelled") {
        const { data: rules } = (await repo.findBookingRules(businessId)) as {
          data: { cancellation_window_minutes: number } | null;
          error: import("@supabase/supabase-js").PostgrestError | null;
        };

        if (rules && userRole === "staff") {
          const cancelCheck = canCancel(
            new Date(appointment.start_time),
            rules.cancellation_window_minutes
          );
          if (!cancelCheck.allowed) throw new AppError(400, cancelCheck.error!);
        }
      }

      const { data, error } = (await repo.update(appointmentId, businessId, {
        status: newStatus,
      })) as {
        data: { id: string; [key: string]: unknown } | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };

      if (error) throw new AppError(400, error.message);

      if (data?.id) {
        await deps.cache.clear(`appts:${businessId}:*`);
        const templateId = newStatus === "cancelled" ? "cancellation" : null;
        if (templateId) {
          deps.notify
            .sendAppointment(data.id, templateId)
            .catch((err) => console.error("[Notification] status change failed:", err));
        }
        deps.gcal
          .pushAppointment(data.id)
          .catch((err) => console.error("[gcal] pushAppointment failed:", err));
      }

      return data;
    },

    async reschedule(businessId: string, appointmentId: string, startTime: string) {
      const { data: apt } = (await repo.findById(
        appointmentId,
        businessId,
        "id, status, service_id"
      )) as {
        data: { id: string; status: string; service_id: string } | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };

      if (!apt) throw new AppError(404, "Appointment not found");
      if (["completed", "cancelled", "no_show"].includes(apt.status)) {
        throw new AppError(400, "Cannot reschedule an appointment with status: " + apt.status);
      }

      const { data: serviceRow, error: serviceErr } = (await repo.findServiceById(
        businessId,
        apt.service_id
      )) as {
        data: { duration_minutes: number; buffer_minutes: number; max_capacity: number } | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };
      if (serviceErr || !serviceRow) throw new AppError(404, "Service not found");

      const service = serviceRow as {
        duration_minutes: number;
        buffer_minutes: number;
        max_capacity: number;
      };

      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + service.duration_minutes * 60 * 1000);

      await checkSlotCapacity(businessId, apt.service_id, startDate, service, appointmentId);

      const { data, error } = (await repo.update(
        appointmentId,
        businessId,
        {
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
        },
        "*, services(name_he, color), customers(name, phone)"
      )) as {
        data: Record<string, unknown> | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };

      if (error) throw new AppError(400, error.message);

      deps.notify
        .sendAppointment(appointmentId, "reschedule")
        .catch((err) => console.error("[reschedule] notification failed:", err));

      return data;
    },

    async approve(appointmentId: string) {
      const { data: target, error: fetchErr } = (await repo.findById(
        appointmentId,
        undefined,
        "id, business_id, status, start_time, end_time"
      )) as {
        data: {
          id: string;
          business_id: string;
          status: string;
          start_time: string;
          end_time: string;
        } | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };

      if (fetchErr || !target) throw new AppError(404, "Appointment not found");
      if (target.status !== "pending_approval") {
        throw new AppError(409, `Cannot approve an appointment with status '${target.status}'`);
      }

      const businessId = target.business_id;

      const { error: updErr } = await repo.updateWhere("id", appointmentId, {
        status: "confirmed",
      });
      if (updErr) throw new AppError(400, updErr.message);

      const { data: overlapping } = (await repo.findOverlappingPendingApproval(
        businessId,
        target.start_time,
        target.end_time,
        appointmentId
      )) as {
        data: { id: string }[] | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };

      const rejectedIds = (overlapping || []).map((r) => r.id);
      if (rejectedIds.length > 0) {
        const { error: rejErr } = await repo.updateIn("id", rejectedIds, {
          status: "cancelled",
          cancellation_reason: "slot_taken",
        });
        if (rejErr) throw new AppError(400, rejErr.message);
      }

      await deps.cache.clear(`appts:${businessId}:*`);

      const notifyResult = await deps.notify
        .sendApproval(appointmentId)
        .catch((err) => {
          console.error("[Notification] approval failed:", err);
          return { sent: false, failed: true };
        });
      const customerNotified = notifyResult?.sent ?? false;
      await Promise.all(
        rejectedIds.map((id) =>
          deps.notify
            .sendRejection(id, "slot_taken")
            .catch((err) => console.error("[Notification] slot_taken rejection failed:", err))
        )
      );

      deps.gcal
        .pushAppointment(appointmentId)
        .catch((err) => console.error("[gcal] pushAppointment failed:", err));
      for (const id of rejectedIds)
        deps.gcal
          .pushAppointment(id)
          .catch((err) => console.error("[gcal] pushAppointment failed:", err));

      return { approved: appointmentId, rejected: rejectedIds, customerNotified };
    },

    async reject(appointmentId: string) {
      const { data: target, error: fetchErr } = (await repo.findById(
        appointmentId,
        undefined,
        "id, business_id, status"
      )) as {
        data: { id: string; business_id: string; status: string } | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      };

      if (fetchErr || !target) throw new AppError(404, "Appointment not found");
      if (target.status !== "pending_approval") {
        throw new AppError(409, `Cannot reject an appointment with status '${target.status}'`);
      }

      const businessId = target.business_id;

      const { error: updErr } = await repo.updateWhere("id", appointmentId, {
        status: "cancelled",
      });
      if (updErr) throw new AppError(400, updErr.message);

      await deps.cache.clear(`appts:${businessId}:*`);

      const notifyResult = await deps.notify
        .sendRejection(appointmentId, "manual")
        .catch((err) => {
          console.error("[Notification] manual rejection failed:", err);
          return { sent: false, failed: true };
        });
      const customerNotified = notifyResult?.sent ?? false;

      deps.gcal
        .pushAppointment(appointmentId)
        .catch((err) => console.error("[gcal] pushAppointment failed:", err));

      return { rejected: appointmentId, customerNotified };
    },
  };
}
