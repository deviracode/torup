import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };
type SingleResult = { data: Record<string, any> | null; error: PostgrestError | null };

export function createAvailabilityRepo(client: SupabaseClient<Database>) {
  return {
    async findService(serviceId: string, businessId: string): Promise<SingleResult> { return client.from("services").select("*").eq("id", serviceId).eq("business_id", businessId).eq("is_active", true).single() as any; },
    async findWorkingHours(businessId: string): Promise<MultiResult> { return client.from("working_hours").select("*").eq("business_id", businessId).is("staff_id", null) as any; },
    async findBreaks(businessId: string): Promise<MultiResult> { return client.from("breaks").select("*").eq("business_id", businessId).is("staff_id", null) as any; },
    async findAppointmentsForDay(businessId: string, serviceId: string, dateStr: string, tzStr: string): Promise<MultiResult> { return client.from("appointments").select("start_time, end_time, staff_id").eq("business_id", businessId).eq("service_id", serviceId).gte("start_time", `${dateStr}T00:00:00${tzStr}`).lte("start_time", `${dateStr}T23:59:59${tzStr}`).not("status", "in", '("cancelled","no_show")') as any; },
    async findBookingRules(businessId: string): Promise<SingleResult> { return client.from("booking_rules").select("*").eq("business_id", businessId).single() as any; },
    async findStaffServices(serviceId: string): Promise<MultiResult> { return client.from("staff_services").select("staff_id").eq("service_id", serviceId) as any; },
    async findStaffOffToday(businessId: string, dateStr: string): Promise<MultiResult> { return client.from("breaks").select("staff_id").eq("business_id", businessId).eq("label", "time_off").eq("specific_date", dateStr).not("staff_id", "is", null) as any; },
  };
}
