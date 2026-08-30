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

export interface AppointmentLinkSummary {
  id: string;
  businessId: string;
  businessName: string;
  serviceName: string;
  startTime: string;
  status: string;
}

export interface AppointmentLinkServiceDeps {
  notifyOwnerOfAttendance: (appointmentId: string, decision: "confirm" | "reject") => Promise<void>;
}

export function createAppointmentLinkService(repo: Repo, deps: AppointmentLinkServiceDeps) {
  async function loadVerified(token: string, phone: string) {
    const { data } = await repo.getByToken(token);
    if (!data) throw new AppError(404, "Appointment link not found");
    const row = data as unknown as AppointmentLinkRow;
    return verifyRow(row, phone);
  }

  function verifyRow(data: AppointmentLinkRow, phone: string) {
    if (normalizePhone(data.customers.phone) !== normalizePhone(phone)) {
      throw new AppError(403, "Phone number does not match this appointment");
    }
    if (INACTIVE_STATUSES.has(data.status)) {
      throw new AppError(410, "This appointment is no longer active");
    }
    return data;
  }

  async function verifyAndGet(token: string, phone: string): Promise<AppointmentLinkSummary> {
    const apt = await loadVerified(token, phone);
    const serviceName = apt.services.name_he;
    return {
      id: apt.id,
      businessId: apt.business_id,
      businessName: apt.businesses.name,
      serviceName,
      startTime: apt.start_time,
      status: apt.status,
    };
  }

  async function setAttendance(token: string, phone: string, decision: "confirm" | "reject") {
    const apt = await loadVerified(token, phone);
    const status = decision === "confirm" ? "confirmed" : "cancelled";
    await repo.updateAttendance(apt.id, status, decision === "confirm");
    await deps.notifyOwnerOfAttendance(apt.id, decision);
    return { status };
  }

  return { verifyAndGet, setAttendance };
}
