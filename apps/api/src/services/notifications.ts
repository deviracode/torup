import { createServiceClient } from "../lib/supabase.js";
import {
  sendInteractiveReminder,
  sendManagerApprovalRequest,
  sendManagerNewBookingTemplate,
  sendWhatsAppMessage,
} from "./whatsapp.js";

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
  rebook_url?: string;
}

const templates: Record<string, Record<string, string>> = {
  booking_confirmation: {
    he: "שלום {customer_name}, התור שלך ב-{business_name} אושר!\n📋 {service_name}\n📅 {date}\n⏰ {time}",
    ar: "أهلين {customer_name}، تأكد دورك عند {business_name}! 🎉\n📋 {service_name}\n📅 {date}\n⏰ {time}",
    en: "Hi {customer_name}, your appointment at {business_name} is confirmed!\n📋 {service_name}\n📅 {date}\n⏰ {time}",
  },
  cancellation: {
    he: "התור שלך ב-{business_name} בתאריך {date} בשעה {time} בוטל.",
    ar: "اتلغى دورك عند {business_name} يوم {date} الساعة {time}.",
    en: "Your appointment at {business_name} on {date} at {time} has been cancelled.",
  },
  reschedule: {
    he: "התור שלך ב-{business_name} שונה ל-{date} בשעה {time}.",
    ar: "اتغير دورك عند {business_name} على {date} الساعة {time}.",
    en: "Your appointment at {business_name} has been rescheduled to {date} at {time}.",
  },
  approval: {
    he: "✅ {customer_name}, התור שלך ב-{business_name} אושר!\n📋 {service_name}\n📅 {date}\n⏰ {time}\nנתראה! 😊",
    ar: "✅ {customer_name}، تم تأكيد موعدك في {business_name}!\n📋 {service_name}\n📅 {date}\n⏰ {time}\nنراك قريباً! 😊",
    en: "✅ {customer_name}, your appointment at {business_name} has been approved!\n📋 {service_name}\n📅 {date}\n⏰ {time}\nSee you soon! 😊",
  },
  rejection_slot_taken: {
    he: "מצטערים {customer_name} 🙏\nהתור שביקשתם ב-{business_name} ב-{date} בשעה {time} ניתן ללקוח אחר.\nניתן לקבוע תור אחר כאן: {rebook_url}",
    ar: "نأسف {customer_name} 🙏\nالموعد الذي طلبته في {business_name} بتاريخ {date} الساعة {time} تم حجزه من قِبل عميل آخر.",
    en: "Sorry {customer_name} 🙏\nThe slot you requested at {business_name} on {date} at {time} was given to another customer.\nYou can book a different time here: {rebook_url}",
  },
  rejection_manual: {
    he: "{customer_name}, לצערנו לא נוכל לקבל אותך ב-{business_name} ב-{date} בשעה {time}.\nניתן לקבוע תור אחר כאן: {rebook_url}",
    ar: "{customer_name}، للأسف لن نتمكن من استقبالك في {business_name} بتاريخ {date} الساعة {time}.",
    en: "{customer_name}, unfortunately we can't host you at {business_name} on {date} at {time}.\nYou can book a different time here: {rebook_url}",
  },
  waitlist_available: {
    he: "התפנה מקום ב-{business_name}! 🎉\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nיש לך 15 דקות לאשר.",
    ar: "أصبح هناك موعد متاح في {business_name}! 🎉\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nلديك 15 دقيقة للتأكيد.",
    en: "A slot opened up at {business_name}! 🎉\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nYou have 15 minutes to confirm.",
  },
};

function fillTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/{customer_name}/g, vars.customer_name)
    .replace(/{business_name}/g, vars.business_name)
    .replace(/{service_name}/g, vars.service_name)
    .replace(/{date}/g, vars.date)
    .replace(/{time}/g, vars.time)
    .replace(/{rebook_url}/g, vars.rebook_url || "");
}

function buildReminderBody(
  minutesBefore: number,
  language: string,
  vars: TemplateVars
): string {
  const lang = ["he", "ar", "en"].includes(language) ? language : "he";
  const m = Math.max(1, Math.floor(minutesBefore));
  const detail = `\n📋 ${vars.service_name} • ${vars.business_name}`;

  let lead: string;
  if (m === 1440) {
    lead =
      lang === "he"
        ? `תזכורת: יש לך תור מחר בשעה ${vars.time} ⏰`
        : lang === "ar"
        ? `تذكير: لديك موعد غداً الساعة ${vars.time} ⏰`
        : `Reminder: appointment tomorrow at ${vars.time} ⏰`;
  } else if (m >= 1441) {
    const days = Math.round(m / 1440);
    lead =
      lang === "he"
        ? `תזכורת: יש לך תור בעוד ${days} ימים ב-${vars.time} ⏰`
        : lang === "ar"
        ? `تذكير: لديك موعد بعد ${days} أيام الساعة ${vars.time} ⏰`
        : `Reminder: appointment in ${days} days at ${vars.time} ⏰`;
  } else if (m === 60) {
    lead =
      lang === "he"
        ? `תזכורת: התור שלך בעוד שעה ⏰ ${vars.time}`
        : lang === "ar"
        ? `تذكير: موعدك بعد ساعة ⏰ ${vars.time}`
        : `Reminder: appointment in 1 hour ⏰ ${vars.time}`;
  } else if (m > 60) {
    const hours = Math.round(m / 60);
    lead =
      lang === "he"
        ? `תזכורת: התור שלך בעוד ${hours} שעות ⏰ ${vars.time}`
        : lang === "ar"
        ? `تذكير: موعدك بعد ${hours} ساعات ⏰ ${vars.time}`
        : `Reminder: appointment in ${hours}h ⏰ ${vars.time}`;
  } else {
    lead =
      lang === "he"
        ? `תזכורת: התור שלך בעוד ${m} דקות ⏰ ${vars.time}`
        : lang === "ar"
        ? `تذكير: موعدك بعد ${m} دقيقة ⏰ ${vars.time}`
        : `Reminder: appointment in ${m} min ⏰ ${vars.time}`;
  }

  return lead + detail;
}

export function renderTemplate(
  templateId: string,
  language: string,
  vars: TemplateVars
): string {
  const reminderMatch = templateId.match(/^reminder_(\d+)m$/);
  if (reminderMatch) {
    return buildReminderBody(parseInt(reminderMatch[1], 10), language, vars);
  }
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
  status: "sent" | "failed";
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
  templateId: string,
  extraVars: Partial<TemplateVars> = {},
  options: { interactiveReminder?: boolean } = {}
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
    ...extraVars,
  };

  const message = renderTemplate(templateId, lang, vars);

  const isReminder = templateId.startsWith("reminder_");
  const useButtons = isReminder && (options.interactiveReminder !== false);
  let whatsappMessageId: string | null = null;
  let sendError: string | null = null;

  try {
    if (useButtons) {
      whatsappMessageId = await sendInteractiveReminder(customer.phone, message, lang);
    } else {
      whatsappMessageId = await sendWhatsAppMessage(customer.phone, message);
    }
    if (!whatsappMessageId) {
      // The error detail was already logged inside sendWhatsAppMessage
      sendError = "WhatsApp send returned null (see [WhatsApp] log above for API error)";
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
    console.error(`[Notification] ${templateId} to ${customer.phone} threw:`, sendError);
  }

  const succeeded = whatsappMessageId !== null && sendError === null;
  if (!succeeded) {
    console.error(`[Notification] FAILED ${templateId} → ${customer.phone} | ${sendError}`);
  }

  await logNotification({
    business_id: apt.business_id,
    customer_id: customer.id,
    appointment_id: appointmentId,
    type: templateId,
    channel: "whatsapp",
    template_id: templateId,
    status: succeeded ? "sent" : "failed",
    whatsapp_message_id: whatsappMessageId,
    error: sendError ?? undefined,
  });

  return { sent: succeeded, failed: !succeeded };
}

export async function sendApprovalNotification(appointmentId: string) {
  return sendAppointmentNotification(appointmentId, "approval");
}

export async function sendRejectionNotification(
  appointmentId: string,
  kind: "slot_taken" | "manual"
) {
  const templateId = kind === "slot_taken" ? "rejection_slot_taken" : "rejection_manual";
  // Inject rebook_url into vars by piggy-backing on sendAppointmentNotification:
  // it builds vars from the appointment row. We add rebook_url here through a
  // small wrapper that loads the service id and constructs the link.
  const supabase = createServiceClient();
  const { data: apt } = await supabase
    .from("appointments")
    .select("business_id, service_id")
    .eq("id", appointmentId)
    .single();
  const appUrl = process.env.APP_URL || "https://book.example";
  const rebookUrl = apt
    ? `${appUrl}/book/${apt.business_id}?service=${apt.service_id}`
    : appUrl;
  return sendAppointmentNotification(appointmentId, templateId, { rebook_url: rebookUrl });
}

/**
 * Send a WhatsApp notification to the business owner about a new appointment.
 */
export async function sendManagerNotification(appointmentId: string) {
  const supabase = createServiceClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, business_id, start_time, status, " +
      "customers(id, name, phone), " +
      "services(name_he), " +
      "businesses(name, phone)"
    )
    .eq("id", appointmentId)
    .single();

  if (!appointment) return;

  const apt = appointment as unknown as {
    id: string; business_id: string; start_time: string; status: string;
    customers: { id: string; name: string; phone: string };
    services: { name_he: string };
    businesses: { name: string; phone: string };
  };

  const ownerPhone = apt.businesses.phone;
  if (!ownerPhone) return;

  const startDate = new Date(apt.start_time);
  const dateStr = startDate.toLocaleDateString("he-IL", {
    weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Jerusalem",
  });
  const timeStr = startDate.toLocaleTimeString("he-IL", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem",
  });

  const statusLabel = apt.status === "pending_approval" ? "ממתין לאישור" : "אושר";

  // Quick-reply WhatsApp templates are exempt from Meta's 24h customer-service window
  // (free-form "interactive" messages below are not — see error 131047). Flip this once
  // the "manager_new_booking" template is approved in WhatsApp Manager.
  const useTemplate = process.env.WHATSAPP_MANAGER_TEMPLATE_APPROVED === "true";

  let whatsappMessageId: string | null = null;
  try {
    if (useTemplate) {
      whatsappMessageId = await sendManagerNewBookingTemplate(
        ownerPhone,
        { customerName: apt.customers.name, serviceName: apt.services.name_he, date: dateStr, time: timeStr },
        apt.id
      );
    } else {
      const message =
        `🔔 תור חדש ממתין לאישורך!\n` +
        `👤 ${apt.customers.name}\n` +
        `✂️ ${apt.services.name_he}\n` +
        `📅 ${dateStr} ⏰ ${timeStr}\n` +
        `📱 ${apt.customers.phone}`;
      whatsappMessageId = await sendManagerApprovalRequest(ownerPhone, message, apt.id);
    }
  } catch (err) {
    console.error("Failed to send manager notification:", err);
  }

  await logNotification({
    business_id: apt.business_id,
    customer_id: apt.customers.id,
    appointment_id: appointmentId,
    type: "manager_new_booking",
    channel: "whatsapp",
    template_id: "manager_new_booking",
    status: whatsappMessageId ? "sent" : "failed",
    whatsapp_message_id: whatsappMessageId,
    error: whatsappMessageId ? undefined : "WhatsApp send failed",
  });
}

/**
 * Check for appointments needing reminders and send them.
 * Uses per-business configurable intervals from reminder_settings table.
 * Should be called periodically (e.g., every 5 minutes via cron).
 */
export async function processReminders(): Promise<{ processed: number; sent: number; failed: number }> {
  const supabase = createServiceClient();
  const now = new Date();
  const WINDOW_MINUTES = 5;
  let processed = 0;
  let sent = 0;
  let failed = 0;

  const { data: settings } = await supabase
    .from("reminder_settings")
    .select("id, business_id, minutes_before")
    .eq("is_active", true);

  if (!settings || settings.length === 0) return { processed, sent, failed };

  for (const setting of settings) {
    const windowStart = new Date(now.getTime() + (setting.minutes_before - WINDOW_MINUTES) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (setting.minutes_before + WINDOW_MINUTES) * 60 * 1000);

    const templateId = `reminder_${setting.minutes_before}m`;

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, services(reminder_confirmation)")
      .eq("business_id", setting.business_id)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", windowStart.toISOString())
      .lt("start_time", windowEnd.toISOString());

    for (const apt of (appointments || []) as unknown as Array<{ id: string; services: { reminder_confirmation: boolean } | null }>) {
      // Atomically claim this (appointment, template) pair. If another instance
      // already claimed it the INSERT will conflict and we skip — this eliminates
      // the read-before-write race that caused duplicate messages.
      const { error: claimError } = await supabase
        .from("appointment_reminders_sent")
        .insert({ appointment_id: apt.id, template_id: templateId });

      if (claimError) {
        // Unique violation (code 23505) = already claimed. Any other error is
        // unexpected but we still skip to avoid accidental duplicates.
        continue;
      }

      processed += 1;
      const interactiveReminder = apt.services?.reminder_confirmation !== false;
      const result = await sendAppointmentNotification(apt.id, templateId, {}, { interactiveReminder });
      if (result?.sent) sent += 1;
      if (result?.failed) failed += 1;
    }
  }

  return { processed, sent, failed };
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

  const { data: updated, error: updErr } = await supabase
    .from("notifications_log")
    .update(updateData)
    .eq("whatsapp_message_id", messageId)
    .select("business_id, type")
    .maybeSingle();

  if (updErr) {
    console.error(`[Delivery Status] Failed to persist status for ${messageId}:`, updErr.message);
    return;
  }

  console.log(`[Delivery Status] Message: ${messageId}, Status: ${status}${error ? ` | ${error}` : ""}`);

  // Manager booking alerts have no in-app fallback — if delivery fails, the owner
  // never learns about the booking unless this is surfaced loudly. The 131047
  // "outside the 24h window" failure mode silently dropped these for weeks before
  // anyone noticed (see business 018a5da3..., June 2026).
  if (status === "failed" && updated?.type === "manager_new_booking") {
    console.error(
      `[ALERT] Manager booking notification undelivered — business_id=${updated.business_id} ` +
      `message=${messageId} error="${error}". Owner did NOT receive this booking alert.`
    );
  }
}

// Start reminder processing interval (every 5 minutes)
/**
 * Auto-complete past appointments that were confirmed/in_progress/pending.
 * Also cancels unresolved pending_approval appointments whose slot has passed.
 * Safe to call repeatedly — only touches rows where end_time < NOW().
 */
export async function autoCompletePastAppointments(): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const [completedResult, cancelledResult] = await Promise.all([
    supabase
      .from("appointments")
      .update({ status: "completed" })
      .in("status", ["confirmed", "in_progress", "pending"])
      .lt("end_time", now)
      .select("id"),
    supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("status", "pending_approval")
      .lt("end_time", now)
      .select("id"),
  ]);

  const completed = completedResult.data?.length ?? 0;
  const cancelled = cancelledResult.data?.length ?? 0;
  if (completed > 0 || cancelled > 0) {
    console.log(`[AutoComplete] Marked ${completed} appointments completed, ${cancelled} cancelled`);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (reminderInterval) return;
  reminderInterval = setInterval(() => {
    autoCompletePastAppointments().catch((err) =>
      console.error("Auto-complete failed:", err)
    );
    processReminders().catch((err) =>
      console.error("Reminder processing failed:", err)
    );
  }, 5 * 60 * 1000);

  // Also run immediately on startup
  autoCompletePastAppointments().catch((err) =>
    console.error("Initial auto-complete failed:", err)
  );
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
