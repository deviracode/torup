import { createClient } from "@torup/db";

function normalizePhone(p: string): string {
  return p.startsWith("972") ? "0" + p.slice(3) : p;
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function executeTool(
  toolName: string,
  input: Record<string, string>,
  businessId: string,
  language: "he" | "ar" | "en" = "he"
): Promise<string> {
  const supabase = getSupabase();

  switch (toolName) {
    case "list_appointments": {
      const { customer_phone } = input;
      const normalizedPhone = normalizePhone(customer_phone);

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", normalizedPhone)
        .single();

      if (!customer) return "No appointments found.";

      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, status, services(name_he, name_ar, name_en)")
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
