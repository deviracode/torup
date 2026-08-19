import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export function createAvailabilityRepo(client: SupabaseClient<Database>) {
  return {
    async findService(serviceId: string, businessId: string) {
      return client
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .eq("is_active", true)
        .single();
    },
    async findWorkingHours(businessId: string) {
      return client
        .from("working_hours")
        .select("*")
        .eq("business_id", businessId)
        .is("staff_id", null);
    },
    async findBreaks(businessId: string) {
      return client.from("breaks").select("*").eq("business_id", businessId).is("staff_id", null);
    },
    async findAppointmentsForDay(
      businessId: string,
      serviceId: string,
      dateStr: string,
      tzStr: string
    ) {
      return client
        .from("appointments")
        .select("start_time, end_time, staff_id")
        .eq("business_id", businessId)
        .eq("service_id", serviceId)
        .gte("start_time", `${dateStr}T00:00:00${tzStr}`)
        .lte("start_time", `${dateStr}T23:59:59${tzStr}`)
        .not("status", "in", '("cancelled","no_show")');
    },
    async findBookingRules(businessId: string) {
      return client.from("booking_rules").select("*").eq("business_id", businessId).single();
    },
    async findStaffServices(serviceId: string) {
      return client.from("staff_services").select("staff_id").eq("service_id", serviceId);
    },
    async findStaffOffToday(businessId: string, dateStr: string) {
      return client
        .from("breaks")
        .select("staff_id")
        .eq("business_id", businessId)
        .eq("label", "time_off")
        .eq("specific_date", dateStr)
        .not("staff_id", "is", null);
    },
  };
}
