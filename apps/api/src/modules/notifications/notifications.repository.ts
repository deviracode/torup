import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

type MultiResult = { data: Record<string, any>[] | null; error: PostgrestError | null };

export function createNotificationRepo(client: SupabaseClient<Database>) {
  return {
    async findLog(
      businessId: string,
      opts?: { limit?: number; offset?: number; type?: string; appointmentId?: string },
    ): Promise<MultiResult> {
      let query = client
        .from("notifications_log")
        .select("*, customers(name, phone)")
        .eq("business_id", businessId)
        .order("sent_at", { ascending: false })
        .range(opts?.offset ?? 0, (opts?.offset ?? 0) + (opts?.limit ?? 50) - 1);

      if (opts?.type) query = query.like("type", `${opts.type}%`);
      if (opts?.appointmentId) query = query.eq("appointment_id", opts.appointmentId);

      return query as any;
    },
  };
}
