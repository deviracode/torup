import { createServiceClient } from "../lib/supabase.js";
import { sendInteractiveReminder, sendWhatsAppMessage } from "./whatsapp.js";

/**
 * Notifications Engine
 * Handles scheduling and sending reminders, confirmations, cancellations.
 */

// Template variable substitution
interface TemplateVars {
  customer_name: string;
  business_name: string;
  service_name: string;
  date: string;
  time: string;
}

const templates: Record<string, Record<string, string>> = {
  booking_confirmation: {
    he: "שלום {customer_name}, התור שלך ב-{business_name} אושר!\n📋 {service_name}\n📅 {date}\n⏰ {time}",
    ar: "مرحبا {customer_name}، تم تأكيد موعدك في {business_name}!\n📋 {service_name}\n📅 {date}\n⏰ {time}",
    en: "Hi {customer_name}, your appointment at {business_name} is confirmed!\n📋 {service_name}\n📅 {date}\n⏰ {time}",
  },
  reminder_24h: {
    he: "תזכורת: יש לך תור מחר ב-{business_name} בשעה {time}.\n📋 {service_name}",
    ar: "تذكير: لديك موعد غدا في {business_name} الساعة {time}.\n📋 {service_name}",
    en: "Reminder: You have an appointment tomorrow at {business_name} at {time}.\n📋 {service_name}",
  },
  reminder_2h: {
    he: "תזכורת: התור שלך ב-{business_name} בעוד שעתיים! ⏰ {time}",
    ar: "تذكير: موعدك في {business_name} بعد ساعتين! ⏰ {time}",
    en: "Reminder: Your appointment at {business_name} is in 2 hours! ⏰ {time}",
  },
  cancellation: {
    he: "התור שלך ב-{business_name} בתאריך {date} בשעה {time} בוטל.",
    ar: "تم إلغاء موعدك في {business_name} بتاريخ {date} الساعة {time}.",
    en: "Your appointment at {business_name} on {date} at {time} has been cancelled.",
  },
  reschedule: {
    he: "התור שלך ב-{business_name} שונה ל-{date} בשעה {time}.",
    ar: "تم تغيير موعدك في {business_name} إلى {date} الساعة {time}.",
    en: "Your appointment at {business_name} has been rescheduled to {date} at {time}.",
  },
  waitlist_available: {
    he: "התפנה מקום ב-{business_name}! 🎉\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nיש לך 15 דקות לאשר.",
    ar: "توفر مكان في {business_name}! 🎉\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nلديك 15 دقيقة للتأكيد.",
    en: "A slot opened up at {business_name}! 🎉\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nYou have 15 minutes to confirm.",
  },
};

function fillTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/{customer_name}/g, vars.customer_name)
    .replace(/{business_name}/g, vars.business_name)
    .replace(/{service_name}/g, vars.service_name)
    .replace(/{date}/g, vars.date)
    .replace(/{time}/g, vars.time);
}

export function renderTemplate(
  templateId: string,
  language: string,
  vars: TemplateVars
): string {
  const tmpl = templates[templateId]?.[language] || templates[templateId]?.he || "";
  return fillTemplate(tmpl, vars);
}

/**
 * Log a notification to the database.
 */
async function logNotification(params: {
  business_id: string;
  customer_id: string;
  appointment_id?: string;
  type: string;
  channel: string;
  template_id: string;
  status: string;
  error?: string;
  whatsapp_message_id?: string | null;
}) {
  const supabase = createServiceClient();
  await supabase.from("notifications_log").insert({
    ...params,
    sent_at: new Date().toISOString(),
  });
}

/**
 * Send a notification for an appointment event.
 */
export async function sendAppointmentNotification(
  appointmentId: string,
  templateId: string
) {
  const supabase = createServiceClient();

  // Get appointment with customer and service details
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, business_id, customer_id, start_time, status, " +
      "customers(id, name, phone, language_preference), " +
      "services(name_he, name_ar, name_en), " +
      "businesses(name)"
    )
    .eq("id", appointmentId)
    .single();

  if (!appointment) return;

  const apt = appointment as unknown as {
    id: string;
    business_id: string;
    customer_id: string;
    start_time: string;
    status: string;
    customers: { id: string; name: string; phone: string; language_preference: string };
    services: { name_he: string; name_ar: string | null; name_en: string | null };
    businesses: { name: string };
  };

  const customer = apt.customers;
  const service = apt.services;
  const business = apt.businesses;

  if (!customer || !service || !business) return;

  const lang = customer.language_preference || "he";
  const serviceName =
    lang === "ar" && service.name_ar
      ? service.name_ar
      : lang === "en" && service.name_en
      ? service.name_en
      : service.name_he;

  const startDate = new Date(apt.start_time);
  const vars: TemplateVars = {
    customer_name: customer.name,
    business_name: business.name,
    service_name: serviceName,
    date: startDate.toLocaleDateString(lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Jerusalem",
    }),
    time: startDate.toLocaleTimeString(lang === "he" ? "he-IL" : lang === "ar" ? "ar" : "en", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }),
  };

  const message = renderTemplate(templateId, lang, vars);

  const isReminder = templateId.startsWith("reminder_");
  let whatsappMessageId: string | null = null;

  if (isReminder) {
    whatsappMessageId = await sendInteractiveReminder(customer.phone, message, lang);
  } else {
    whatsappMessageId = await sendWhatsAppMessage(customer.phone, message);
  }

  await logNotification({
    business_id: apt.business_id,
    customer_id: customer.id,
    appointment_id: appointmentId,
    type: templateId,
    channel: "whatsapp",
    template_id: templateId,
    status: "sent",
    whatsapp_message_id: whatsappMessageId,
  });
}

/**
 * Check for appointments needing reminders and send them.
 * Uses per-business configurable intervals from reminder_settings table.
 * Should be called periodically (e.g., every 5 minutes via cron).
 */
export async function processReminders() {
  const supabase = createServiceClient();
  const now = new Date();
  const WINDOW_MINUTES = 5;

  const { data: settings } = await supabase
    .from("reminder_settings")
    .select("id, business_id, minutes_before")
    .eq("is_active", true);

  if (!settings || settings.length === 0) return;

  for (const setting of settings) {
    const windowStart = new Date(now.getTime() + (setting.minutes_before - WINDOW_MINUTES) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (setting.minutes_before + WINDOW_MINUTES) * 60 * 1000);

    const templateId = `reminder_${setting.minutes_before}m`;

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id")
      .eq("business_id", setting.business_id)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", windowStart.toISOString())
      .lt("start_time", windowEnd.toISOString());

    for (const apt of appointments || []) {
      const { data: existing } = await supabase
        .from("notifications_log")
        .select("id")
        .eq("appointment_id", apt.id)
        .eq("template_id", templateId)
        .limit(1);

      if (!existing || existing.length === 0) {
        await sendAppointmentNotification(apt.id, templateId);
      }
    }
  }
}

/**
 * Notify waitlisted customers when a slot opens up.
 */
export async function processWaitlistNotifications(
  businessId: string,
  serviceId: string,
  date: string
) {
  const supabase = createServiceClient();

  // Find waiting customers for this service/date
  const { data: waitlistEntries } = await supabase
    .from("waitlist")
    .select("id, customer_id")
    .eq("business_id", businessId)
    .eq("service_id", serviceId)
    .eq("requested_date", date)
    .eq("status", "waiting")
    .order("created_at")
    .limit(1);

  if (!waitlistEntries || waitlistEntries.length === 0) return;

  const entry = waitlistEntries[0];

  // Mark as notified with 15-min claim window
  await supabase
    .from("waitlist")
    .update({ status: "notified" })
    .eq("id", entry.id);

  // Get customer info for notification
  const { data: customer } = await supabase
    .from("customers")
    .select("phone, name, language_preference")
    .eq("id", entry.customer_id)
    .single();

  if (!customer) return;

  const { data: service } = await supabase
    .from("services")
    .select("name_he")
    .eq("id", serviceId)
    .single();

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .single();

  if (!service || !business) return;

  const lang = customer.language_preference || "he";
  const message = renderTemplate("waitlist_available", lang, {
    customer_name: customer.name,
    business_name: business.name,
    service_name: service.name_he,
    date,
    time: "",
  });

  console.log(`[Waitlist Notification] To: ${customer.phone}, Message: ${message}`);

  await logNotification({
    business_id: businessId,
    customer_id: entry.customer_id,
    type: "waitlist_available",
    channel: "whatsapp",
    template_id: "waitlist_available",
    status: "sent",
  });
}

/**
 * Update delivery status from WhatsApp webhook status updates.
 */
export async function updateDeliveryStatus(
  messageId: string,
  status: "delivered" | "read" | "failed",
  error?: string
) {
  const supabase = createServiceClient();

  const updateData: Record<string, string> = { status };
  if (status === "delivered") updateData.delivered_at = new Date().toISOString();
  if (status === "read") updateData.read_at = new Date().toISOString();
  if (error) updateData.error = error;

  // In production, correlate messageId with notification_log entry
  // For now, just log it
  console.log(`[Delivery Status] Message: ${messageId}, Status: ${status}`);
}

// Start reminder processing interval (every 5 minutes)
let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (reminderInterval) return;
  reminderInterval = setInterval(() => {
    processReminders().catch((err) =>
      console.error("Reminder processing failed:", err)
    );
  }, 5 * 60 * 1000);

  // Also run immediately
  processReminders().catch((err) =>
    console.error("Initial reminder processing failed:", err)
  );

  console.log("Reminder scheduler started (every 5 minutes)");
}

export function stopReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
