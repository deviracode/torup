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

      // Never return raw start_time/end_time here — Claude has no timezone
      // context and will misreport the hour (this caused a real bug: a
      // 14:00 Israel-time appointment was read back to the customer as
      // "11:00", the raw UTC hour). Always pre-format to Israel local time.
      const locale = language === "he" ? "he-IL" : language === "ar" ? "ar" : "en";
      const formatted = appointments.map((apt) => {
        const startDate = new Date(apt.start_time);
        const service = apt.services as unknown as {
          name_he: string; name_ar: string | null; name_en: string | null;
        } | null;
        const serviceName =
          language === "ar" && service?.name_ar ? service.name_ar :
          language === "en" && service?.name_en ? service.name_en :
          service?.name_he ?? "";
        return {
          id: apt.id,
          date: startDate.toLocaleDateString(locale, {
            weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
          }),
          time: startDate.toLocaleTimeString(locale, {
            hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
          }),
          status: apt.status,
          service_name: serviceName,
        };
      });
      return JSON.stringify(formatted);
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
