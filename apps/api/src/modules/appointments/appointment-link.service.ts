import { AppError } from "../../middleware/error-handler";
import type { createAppointmentLinkRepo, AppointmentLinkRow } from "./appointment-link.repository";

type Repo = ReturnType<typeof createAppointmentLinkRepo>;

const INACTIVE_STATUSES = new Set(["cancelled", "completed", "no_show"]);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

function minutesUntil(isoTime: string): number {
  return (new Date(isoTime).getTime() - Date.now()) / 60_000;
}

export interface AppointmentLinkSummary {
  id: string;
  businessId: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  startTime: string;
  status: string;
}

export interface AppointmentLinkServiceDeps {
  notifyOwnerOfAttendance: (appointmentId: string, decision: "confirm" | "reject") => Promise<void>;
  getCancellationWindowMinutes: (businessId: string) => Promise<number>;
}

export function createAppointmentLinkService(repo: Repo, deps: AppointmentLinkServiceDeps) {
  // Anti-enumeration: "bad token" and "wrong phone" are merged into a single,
  // indistinguishable 404 response. A caller without the correct phone number
  // must not be able to tell "token invalid" from "token valid, wrong phone"
  // apart via status code or message. The 410 "inactive appointment" case
  // below is intentionally NOT merged: reaching it already requires the phone
  // number to have matched, i.e. the caller has already proven they're the
  // legitimate customer, so it leaks nothing new to tell them the appointment
  // is no longer active.
  async function loadVerified(token: string, phone: string) {
    const { data } = await repo.getByToken(token);
    const GENERIC_NOT_FOUND = "Appointment link not found or phone number does not match";
    if (!data) throw new AppError(404, GENERIC_NOT_FOUND);
    const row = data as unknown as AppointmentLinkRow;
    if (normalizePhone(row.customers.phone) !== normalizePhone(phone)) {
      throw new AppError(404, GENERIC_NOT_FOUND);
    }
    if (INACTIVE_STATUSES.has(row.status)) {
      throw new AppError(410, "This appointment is no longer active");
    }
    return row;
  }

  async function verifyAndGet(token: string, phone: string): Promise<AppointmentLinkSummary> {
    const apt = await loadVerified(token, phone);
    const serviceName = apt.services.name_he;
    return {
      id: apt.id,
      businessId: apt.business_id,
      businessName: apt.businesses.name,
      serviceId: apt.service_id,
      serviceName,
      startTime: apt.start_time,
      status: apt.status,
    };
  }

  async function setAttendance(token: string, phone: string, decision: "confirm" | "reject") {
    const apt = await loadVerified(token, phone);
    if (decision === "reject") {
      const windowMinutes = await deps.getCancellationWindowMinutes(apt.business_id);
      if (minutesUntil(apt.start_time) < windowMinutes) {
        throw new AppError(400, "Too close to the appointment time to cancel");
      }
    }
    const status = decision === "confirm" ? "confirmed" : "cancelled";
    await repo.updateAttendance(apt.id, status, decision === "confirm");
    deps.notifyOwnerOfAttendance(apt.id, decision).catch((err) => console.error("[Notification] attendance owner notify failed:", err));
    return { status };
  }

  return { verifyAndGet, setAttendance };
}
