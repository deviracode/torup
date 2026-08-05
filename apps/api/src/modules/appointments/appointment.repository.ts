import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

const APPOINTMENT_JOIN_SELECT =
  "*, services(name_he, name_ar, name_en, color), customers(name, phone)" as const;

export function createAppointmentRepo(
  primary: SupabaseClient<Database>,
  serviceRole?: SupabaseClient<Database>
) {
  const svc = serviceRole ?? primary;

  function getILOffset(d: string): string {
    const ref = new Date(`${d}T12:00:00Z`);
    const utcH = ref.getUTCHours();
    const ilH = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jerusalem",
        hour: "numeric",
        hour12: false,
      }).format(ref)
    );
    let diff = ilH - utcH;
    if (diff < 0) diff += 24;
    if (diff > 12) diff -= 24;
    return `+${String(diff).padStart(2, "0")}:00`;
  }

  return {
    async findByDate(
      businessId: string,
      filters?: { date?: string; status?: string; staffId?: string }
    ) {
      const base = primary
        .from("appointments")
        .select(APPOINTMENT_JOIN_SELECT)
        .eq("business_id", businessId)
        .order("start_time");

      let query = base;
      if (filters?.date) {
        const tz = getILOffset(filters.date);
        const dayStart = new Date(`${filters.date}T00:00:00${tz}`).toISOString();
        const dayEnd = new Date(`${filters.date}T23:59:59${tz}`).toISOString();
        query = query.gte("start_time", dayStart).lte("start_time", dayEnd);
      }
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.staffId) query = query.eq("staff_id", filters.staffId);

      return query;
    },

    async findById(appointmentId: string, businessId?: string, columns = "*") {
      const base = primary.from("appointments").select(columns).eq("id", appointmentId);
      const query = businessId ? base.eq("business_id", businessId) : base;
      return query.single();
    },

    async create(data: Record<string, unknown>) {
      return primary
        .from("appointments")
        .insert(data as never)
        .select(APPOINTMENT_JOIN_SELECT)
        .single();
    },

    async update(
      appointmentId: string,
      businessId: string,
      patch: Record<string, unknown>,
      select = "*"
    ) {
      return primary
        .from("appointments")
        .update(patch as never)
        .eq("id", appointmentId)
        .eq("business_id", businessId)
        .select(select)
        .single();
    },

    async findOverlapping(
      businessId: string,
      serviceId: string,
      startTime: string,
      endWithBuffer: string,
      excludeId?: string
    ) {
      let query = primary
        .from("appointments")
        .select("id")
        .eq("business_id", businessId)
        .eq("service_id", serviceId)
        .lt("start_time", endWithBuffer)
        .gt("end_time", startTime)
        .not("status", "in", '("cancelled","no_show")');

      if (excludeId) query = query.neq("id", excludeId);

      return query;
    },

    async findServiceById(businessId: string, serviceId: string) {
      return primary
        .from("services")
        .select("duration_minutes, buffer_minutes, max_capacity")
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .single();
    },

    async findBookingRules(businessId: string) {
      return primary
        .from("booking_rules")
        .select("cancellation_window_minutes")
        .eq("business_id", businessId)
        .single();
    },

    // ── Internal operations (use serviceRole client when available) ──

    async updateWhere(column: string, value: unknown, patch: Record<string, unknown>) {
      return svc
        .from("appointments")
        .update(patch as never)
        .eq(column, value as never);
    },

    async updateIn(column: string, values: string[], patch: Record<string, unknown>) {
      return svc
        .from("appointments")
        .update(patch as never)
        .in(column, values);
    },

    async findOverlappingPendingApproval(
      businessId: string,
      targetStartTime: string,
      targetEndTime: string,
      excludeId: string
    ) {
      return svc
        .from("appointments")
        .select("id")
        .eq("business_id", businessId)
        .eq("status", "pending_approval")
        .neq("id", excludeId)
        .lt("start_time", targetEndTime)
        .gt("end_time", targetStartTime);
    },
  };
}
