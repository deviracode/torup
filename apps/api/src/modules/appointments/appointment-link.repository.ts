import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export type AppointmentLinkRow = {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  business_id: string;
  service_id: string;
  customers: { id: string; name: string; phone: string; language_preference: string };
  services: { name_he: string; name_ar: string | null; name_en: string | null };
  businesses: { name: string };
};

const SELECT_COLUMNS =
  "id, status, start_time, end_time, business_id, service_id, " +
  "customers(id, name, phone, language_preference), " +
  "services(name_he, name_ar, name_en), " +
  "businesses(name)";

export function createAppointmentLinkRepo(client: SupabaseClient<Database>) {
  return {
    async getByToken(token: string) {
      return client
        .from("appointments")
        .select(SELECT_COLUMNS)
        .eq("customer_link_token", token)
        .single();
    },

    async updateAttendance(appointmentId: string, status: "confirmed" | "cancelled", customerConfirmed: boolean) {
      return client
        .from("appointments")
        .update({ status, customer_confirmed: customerConfirmed })
        .eq("id", appointmentId)
        .select("id, status")
        .single();
    },
  };
}
