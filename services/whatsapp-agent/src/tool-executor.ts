import { createClient } from "@torup/db";

/**
 * Execute tool calls from the Claude agent.
 * Each function talks to the database via Supabase service client.
 */

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function executeTool(
  toolName: string,
  input: Record<string, string>,
  businessId: string
): Promise<string> {
  const supabase = getSupabase();

  switch (toolName) {
    case "cancel_booking": {
      const { appointment_id } = input;

      const { data, error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointment_id)
        .eq("business_id", businessId)
        .in("status", ["pending", "confirmed"])
        .select("id, status")
        .single();

      if (error) return `Error: ${error.message}`;
      if (!data) return "Appointment not found or cannot be cancelled.";
      return JSON.stringify(data);
    }

    case "reschedule_booking": {
      const { appointment_id, new_start_time } = input;

      // Get current appointment to calculate new end time
      const { data: current } = await supabase
        .from("appointments")
        .select("service_id")
        .eq("id", appointment_id)
        .single();

      if (!current) return "Appointment not found.";

      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", current.service_id)
        .single();

      if (!service) return "Service not found.";

      const newStart = new Date(new_start_time);
      const newEnd = new Date(newStart.getTime() + service.duration_minutes * 60000);

      const { data, error } = await supabase
        .from("appointments")
        .update({
          start_time: new_start_time,
          end_time: newEnd.toISOString(),
        })
        .eq("id", appointment_id)
        .eq("business_id", businessId)
        .in("status", ["pending", "confirmed"])
        .select("id, start_time, end_time")
        .single();

      if (error) return `Error: ${error.message}`;
      if (!data) return "Appointment not found or cannot be rescheduled.";
      return JSON.stringify(data);
    }

    case "list_appointments": {
      const { customer_phone } = input;

      // Find customer
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customer_phone)
        .single();

      if (!customer) return "No appointments found.";

      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status, services(name_he)")
        .eq("business_id", businessId)
        .eq("customer_id", customer.id)
        .in("status", ["pending", "confirmed"])
        .gte("start_time", new Date().toISOString())
        .order("start_time");

      if (!appointments || appointments.length === 0) return "No upcoming appointments.";
      return JSON.stringify(appointments);
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
