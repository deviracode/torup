import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export type ChangeRequestType = "edit" | "cancel";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequestRow {
  id: string;
  appointment_id: string;
  business_id: string;
  type: ChangeRequestType;
  proposed_start_time: string | null;
  reason: string | null;
  status: ChangeRequestStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const COLUMNS =
  "id, appointment_id, business_id, type, proposed_start_time, reason, status, created_at, resolved_at, resolved_by";

export function createChangeRequestRepo(client: SupabaseClient<Database>) {
  return {
    async findPendingByAppointment(appointmentId: string) {
      return client
        .from("appointment_change_requests")
        .select(COLUMNS)
        .eq("appointment_id", appointmentId)
        .eq("status", "pending")
        .maybeSingle();
    },

    async create(row: {
      appointment_id: string;
      business_id: string;
      type: ChangeRequestType;
      proposed_start_time?: string | null;
      reason?: string | null;
    }) {
      return client
        .from("appointment_change_requests")
        .insert({ ...row, status: "pending" })
        .select(COLUMNS)
        .single();
    },

    async findByIdAndBusiness(id: string, businessId: string) {
      return client
        .from("appointment_change_requests")
        .select(COLUMNS)
        .eq("id", id)
        .eq("business_id", businessId)
        .single();
    },

    async updateStatus(id: string, status: "approved" | "rejected", resolvedBy: string) {
      return client
        .from("appointment_change_requests")
        .update({ status, resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
        .eq("id", id)
        .select(COLUMNS)
        .single();
    },

    async listPendingByBusiness(businessId: string) {
      return client
        .from("appointment_change_requests")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
    },
  };
}
