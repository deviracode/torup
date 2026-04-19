import express, { type Express } from "express";
import { verifySignature, parseWebhookPayload } from "./webhook.js";
import {
  getSession,
  createSession,
  updateSession,
  addMessage,
} from "./session.js";
import { detectLanguage } from "./language.js";
import { processMessage } from "./agent.js";
import { sendTextMessage, sendButtonMessage, sendListMessage, markAsRead } from "./whatsapp-api.js";
import { createClient } from "@queue/db";

const app: Express = express();
const port = process.env.PORT || 3002;

// Raw body parser for signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as Record<string, Buffer>).rawBody = buf;
    },
  })
);

// WhatsApp webhook verification (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp webhook for incoming messages (POST)
app.post("/webhook", async (req, res) => {
  // Acknowledge immediately per Meta requirement
  res.sendStatus(200);

  // Verify signature if app secret is configured
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = (req as unknown as Record<string, Buffer>).rawBody;
    if (!verifySignature(rawBody, signature, appSecret)) {
      console.warn("Invalid webhook signature");
      return;
    }
  }

  // Parse incoming messages
  console.log("Webhook body:", JSON.stringify(req.body).slice(0, 500));
  const messages = parseWebhookPayload(req.body);
  console.log("Parsed messages:", messages.length);
  if (messages.length === 0) return;

  for (const msg of messages) {
    try {
      await handleIncomingMessage(msg.from, msg.text, msg.businessPhoneNumberId, msg.messageId, msg.interactionId);
    } catch (err) {
      console.error("Error processing message:", err);
    }
  }
});

/**
 * Map business WhatsApp phone number IDs to business IDs.
 * In production, this would be a database lookup.
 */
async function resolveBusinessId(phoneNumberId: string): Promise<{ businessId: string; businessName: string } | null> {
  // Try to find from environment mapping
  const mapping = process.env.PHONE_BUSINESS_MAP;
  if (mapping) {
    try {
      const map = JSON.parse(mapping);
      if (map[phoneNumberId]) return map[phoneNumberId];
    } catch {}
  }

  // Fallback: look up in database
  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const { data } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (data) return { businessId: data.id, businessName: data.name };
  return null;
}

async function getBusinessServices(businessId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const { data } = await supabase
    .from("services")
    .select("id, name_he, name_ar, name_en, duration_minutes, price")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("sort_order");

  return data || [];
}

// Cache business info + services (5 min TTL)
const bizCache = new Map<string, { biz: { businessId: string; businessName: string }; services: Record<string, any>[]; expiresAt: number }>();

async function getCachedBusinessContext(businessPhoneNumberId: string) {
  const cached = bizCache.get(businessPhoneNumberId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const biz = await resolveBusinessId(businessPhoneNumberId);
  if (!biz) return null;

  const services = await getBusinessServices(biz.businessId);
  const entry = { biz, services, expiresAt: Date.now() + 5 * 60 * 1000 };
  bizCache.set(businessPhoneNumberId, entry);
  return entry;
}

async function sendMainMenu(phoneNumberId: string, to: string, businessName: string) {
  await sendButtonMessage(phoneNumberId, to,
    `ברוכים הבאים ל${businessName}! 👋\nאיך אפשר לעזור?`,
    [
      { id: "menu_book", title: "קביעת תור" },
      { id: "menu_my_appointments", title: "התורים שלי" },
      { id: "menu_cancel", title: "ביטול תור" },
    ]
  );
}

async function sendServiceList(phoneNumberId: string, to: string, services: Record<string, any>[]) {
  const rows = services.map((s: any) => ({
    id: `service_${s.id || s.name_he}`,
    title: (s.name_he || "").slice(0, 24),
    description: `${s.duration_minutes} דק׳ • ₪${s.price}`,
  }));

  await sendListMessage(phoneNumberId, to,
    "בחרו שירות:",
    "הצג שירותים",
    [{ title: "שירותים", rows }]
  );
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const IL_TZ = "Asia/Jerusalem";

function getIsraelDate(d: Date = new Date()): { dateStr: string; day: number; hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: IL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const timeParts = new Intl.DateTimeFormat("en-US", { timeZone: IL_TZ, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(d);
  const hours = Number(timeParts.find(p => p.type === "hour")?.value || 0);
  const minutes = Number(timeParts.find(p => p.type === "minute")?.value || 0);
  const dayPart = new Intl.DateTimeFormat("en-US", { timeZone: IL_TZ, weekday: "short" }).format(d);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dateStr: parts, day: dayMap[dayPart] ?? 0, hours, minutes };
}

function addDaysIsrael(daysToAdd: number): { dateStr: string; day: number } {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  const info = getIsraelDate(d);
  return { dateStr: info.dateStr, day: info.day };
}

function getIsraelOffset(date: string): string {
  // Determine Israel UTC offset for a given date (handles DST)
  const d = new Date(date + "T12:00:00Z");
  const utcH = d.getUTCHours();
  const ilParts = new Intl.DateTimeFormat("en-US", { timeZone: IL_TZ, hour: "numeric", hour12: false }).formatToParts(d);
  const ilH = Number(ilParts.find(p => p.type === "hour")?.value || 0);
  let offset = ilH - utcH;
  if (offset < 0) offset += 24;
  if (offset > 12) offset -= 24;
  return `+${String(offset).padStart(2, "0")}:00`;
}

async function findNextAvailableDates(businessId: string, serviceId: string, maxDays = 14): Promise<{ date: string; label: string }[]> {
  const results: { date: string; label: string }[] = [];

  for (let i = 0; i < maxDays && results.length < 3; i++) {
    const { dateStr, day: dow } = addDaysIsrael(i);

    const slots = await getAvailableTimeSlots(businessId, serviceId, dateStr);
    if (slots.length === 0) continue;

    let label: string;
    if (i === 0) label = "היום";
    else if (i === 1) label = "מחר";
    else label = `יום ${DAY_NAMES_HE[dow]} (${dateStr.slice(5).replace("-", "/")})`;

    results.push({ date: dateStr, label });
  }

  return results;
}

async function getAvailableTimeSlots(businessId: string, serviceId: string, date: string): Promise<{ time: string; label: string }[]> {
  const supabase = getSupabase();
  const d = new Date(date + "T12:00:00Z");
  const { day: dayOfWeek } = getIsraelDate(d);

  const [hoursRes, serviceRes, aptsRes] = await Promise.all([
    supabase.from("working_hours").select("start_time, end_time, is_closed")
      .eq("business_id", businessId).eq("day_of_week", dayOfWeek).is("staff_id", null),
    supabase.from("services").select("duration_minutes, buffer_minutes, max_capacity")
      .eq("id", serviceId).single(),
    supabase.from("appointments").select("start_time, end_time")
      .eq("business_id", businessId).eq("service_id", serviceId)
      .gte("start_time", `${date}T00:00:00`).lt("start_time", `${date}T23:59:59`)
      .in("status", ["pending", "confirmed", "in_progress"]),
  ]);

  const wh = hoursRes.data?.[0];
  const service = serviceRes.data;
  if (!wh || wh.is_closed || !service) return [];

  const [startH, startM] = wh.start_time.split(":").map(Number);
  const [endH, endM] = wh.end_time.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  const duration = service.duration_minutes;
  const buffer = service.buffer_minutes || 0;
  const step = duration + buffer;
  const slots: { time: string; label: string }[] = [];

  // Filter past times if date is today (Israel time)
  const now = getIsraelDate();
  const isToday = date === now.dateStr;
  const nowMinutes = now.hours * 60 + now.minutes;

  const tzOffset = getIsraelOffset(date);

  for (let m = startMin; m + duration <= endMin && slots.length < 10; m += step) {
    if (isToday && m <= nowMinutes) continue;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const endHH = String(Math.floor((m + duration) / 60)).padStart(2, "0");
    const endMM = String((m + duration) % 60).padStart(2, "0");
    const slotStart = `${date}T${hh}:${mm}:00${tzOffset}`;
    const slotEnd = `${date}T${endHH}:${endMM}:00${tzOffset}`;

    const slotStartUTC = new Date(slotStart).toISOString();
    const slotEndUTC = new Date(slotEnd).toISOString();

    const conflicts = (aptsRes.data || []).filter((a: any) => a.start_time < slotEndUTC && a.end_time > slotStartUTC);
    if (conflicts.length < (service.max_capacity || 1)) {
      slots.push({ time: slotStartUTC, label: `${hh}:${mm}` });
    }
  }

  return slots;
}

async function createBooking(businessId: string, serviceId: string, startTime: string, customerPhone: string): Promise<string> {
  const supabase = getSupabase();

  const { data: service } = await supabase.from("services")
    .select("duration_minutes").eq("id", serviceId).single();
  if (!service) return "שגיאה: שירות לא נמצא";

  // Normalize phone: WhatsApp sends 972..., store as 0...
  const normalizedPhone = customerPhone.startsWith("972")
    ? "0" + customerPhone.slice(3)
    : customerPhone;

  let { data: customer } = await supabase.from("customers")
    .select("id").eq("phone", normalizedPhone).single();

  if (!customer) {
    const { data: c } = await supabase.from("customers")
      .insert({ phone: normalizedPhone, name: normalizedPhone, language_preference: "he" })
      .select("id").single();
    customer = c;
  }
  if (!customer) return "שגיאה: לא ניתן ליצור לקוח";

  const endTime = new Date(new Date(startTime).getTime() + service.duration_minutes * 60000).toISOString();

  const { error } = await supabase.from("appointments").insert({
    business_id: businessId,
    service_id: serviceId,
    customer_id: customer.id,
    start_time: startTime,
    end_time: endTime,
    status: "confirmed",
    created_via: "whatsapp",
  });

  if (error) return `שגיאה: ${error.message}`;
  return "ok";
}

async function handleIncomingMessage(
  from: string,
  text: string,
  businessPhoneNumberId: string,
  messageId: string,
  interactionId?: string
) {
  markAsRead(businessPhoneNumberId, messageId).catch(() => {});

  const ctx = await getCachedBusinessContext(businessPhoneNumberId);
  if (!ctx) {
    console.error("Could not resolve business for phone number:", businessPhoneNumberId);
    return;
  }

  let session = getSession(from, businessPhoneNumberId);

  if (!session) {
    const language = detectLanguage(text);
    session = createSession(from, businessPhoneNumberId, ctx.biz.businessId, language);
  }

  // Handle interactive button/list replies without Claude
  if (interactionId) {
    // Reminder confirm/cancel buttons
    if (interactionId === "confirm" || interactionId === "cancel") {
      const supabase = createClient();
      const { data: customer } = await supabase
        .from("customers")
        .select("id, language_preference")
        .eq("phone", from)
        .single();

      if (customer) {
        const { data: logEntry } = await supabase
          .from("notifications_log")
          .select("appointment_id")
          .eq("customer_id", customer.id)
          .eq("channel", "whatsapp")
          .like("template_id", "reminder_%")
          .order("sent_at", { ascending: false })
          .limit(1);

        if (logEntry?.[0]?.appointment_id) {
          const aptId = logEntry[0].appointment_id;
          const { data: apt } = await supabase
            .from("appointments")
            .select("id, status")
            .eq("id", aptId)
            .single();

          if (apt) {
            const newStatus = interactionId === "confirm" ? "confirmed" : "cancelled";
            if (apt.status === newStatus) {
              const msg = interactionId === "confirm"
                ? "התור שלך כבר מאושר! נתראה 😊"
                : "התור שלך כבר בוטל.";
              await sendTextMessage(businessPhoneNumberId, from, msg);
            } else if (
              (interactionId === "confirm" && ["pending", "confirmed"].includes(apt.status)) ||
              (interactionId === "cancel" && ["pending", "confirmed"].includes(apt.status))
            ) {
              await supabase.from("appointments").update({ status: newStatus }).eq("id", aptId);
              await supabase.from("notifications_log")
                .update({ customer_response: newStatus, responded_at: new Date().toISOString() })
                .eq("appointment_id", aptId)
                .like("template_id", "reminder_%");

              if (interactionId === "confirm") {
                await sendTextMessage(businessPhoneNumberId, from, "התור שלך אושר! נתראה 😊");
              } else {
                await sendTextMessage(businessPhoneNumberId, from, "התור שלך בוטל. תוכל לקבוע תור חדש בכל עת 👋");
              }
            } else {
              await sendTextMessage(businessPhoneNumberId, from, "לא ניתן לשנות את סטטוס התור כרגע.");
            }
            return;
          }
        }
      }
      await sendTextMessage(businessPhoneNumberId, from, "לא נמצא תור מתאים. 🤔");
      return;
    }

    if (interactionId === "menu_book") {
      await sendServiceList(businessPhoneNumberId, from, ctx.services);
      return;
    }

    if (interactionId === "menu_my_appointments" || interactionId === "menu_cancel") {
      const prompt = interactionId === "menu_my_appointments"
        ? "הראה לי את התורים שלי"
        : "אני רוצה לבטל תור";
      const response = await processMessage(session, prompt, {
        businessId: ctx.biz.businessId,
        businessName: ctx.biz.businessName,
        services: ctx.services as any,
        language: session.language,
        customerPhone: from,
      });
      addMessage(from, businessPhoneNumberId, "user", prompt);
      addMessage(from, businessPhoneNumberId, "assistant", response);
      await sendTextMessage(businessPhoneNumberId, from, response);
      return;
    }

    // Service selected → show available dates
    if (interactionId.startsWith("service_")) {
      const serviceId = interactionId.replace("service_", "");
      const serviceName = text;
      const dates = await findNextAvailableDates(ctx.biz.businessId, serviceId);

      if (dates.length === 0) {
        await sendTextMessage(businessPhoneNumberId, from, "אין תאריכים פנויים בשבועיים הקרובים 😔\nנסו שוב מאוחר יותר.");
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { step: "select_date", serviceId, serviceName },
      });

      await sendButtonMessage(businessPhoneNumberId, from,
        `${serviceName} ✂️\nבחרו תאריך:`,
        dates.map((d) => ({ id: `date_${d.date}`, title: d.label }))
      );
      return;
    }

    // Date selected → show available time slots
    if (interactionId.startsWith("date_") && session.booking?.step === "select_date") {
      const date = interactionId.replace("date_", "");
      const slots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, date);

      if (slots.length === 0) {
        await sendTextMessage(businessPhoneNumberId, from, "אין שעות פנויות בתאריך הזה 😔\nנסו תאריך אחר.");
        await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName);
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, step: "select_time", date },
      });

      await sendListMessage(businessPhoneNumberId, from,
        `${session.booking.serviceName} • ${date.slice(5).replace("-", "/")}\nבחרו שעה:`,
        "הצג שעות",
        [{ title: "שעות פנויות", rows: slots.map((s) => ({
          id: `time_${s.time}`,
          title: s.label,
        }))}]
      );
      return;
    }

    // Time selected → confirm
    if (interactionId.startsWith("time_") && session.booking?.step === "select_time") {
      const startTime = interactionId.replace("time_", "");
      const timeLabel = text;

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, step: "confirm", time: startTime },
      });

      await sendButtonMessage(businessPhoneNumberId, from,
        `📋 סיכום הזמנה:\n✂️ ${session.booking.serviceName}\n📅 ${session.booking.date?.slice(5).replace("-", "/")}\n🕐 ${timeLabel}\n\nלאשר?`,
        [
          { id: "confirm_yes", title: "✅ אישור" },
          { id: "confirm_no", title: "❌ ביטול" },
        ]
      );
      return;
    }

    // Confirm booking
    if (interactionId === "confirm_yes" && session.booking?.step === "confirm" && session.booking.time) {
      const result = await createBooking(
        ctx.biz.businessId,
        session.booking.serviceId,
        session.booking.time,
        from
      );

      if (result === "ok") {
        const timeLabel = new Date(session.booking.time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" });
        await sendTextMessage(businessPhoneNumberId, from,
          `✅ התור נקבע בהצלחה!\n\n✂️ ${session.booking.serviceName}\n📅 ${session.booking.date?.slice(5).replace("-", "/")}\n🕐 ${timeLabel}\n\nנתראה! 😊`
        );
      } else {
        await sendTextMessage(businessPhoneNumberId, from, result);
      }

      updateSession(from, businessPhoneNumberId, { booking: undefined });
      return;
    }

    if (interactionId === "confirm_no") {
      updateSession(from, businessPhoneNumberId, { booking: undefined });
      await sendTextMessage(businessPhoneNumberId, from, "ההזמנה בוטלה. 👋");
      await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName);
      return;
    }
  }

  // Greetings → show main menu (no Claude needed)
  const greetingPatterns = /^(שלום|היי|הי|בוקר טוב|ערב טוב|מה נשמע|הגעתי|לאן הגעתי|hi|hello|hey|مرحبا|اهلا)[\s?!]*$/i;
  if (greetingPatterns.test(text.trim())) {
    await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName);
    return;
  }

  // Booking intent → redirect to structured button flow
  const bookingPatterns = /תור|הזמנ|לקבוע|לזמן|book|appointment|schedule|reserve|حجز|موعد/i;
  if (bookingPatterns.test(text.trim())) {
    await sendServiceList(businessPhoneNumberId, from, ctx.services);
    return;
  }

  // Free text → Claude AI (for viewing appointments, cancellations, general questions)
  const response = await processMessage(session, text, {
    businessId: ctx.biz.businessId,
    businessName: ctx.biz.businessName,
    services: ctx.services as any,
    language: session.language,
    customerPhone: from,
  });

  addMessage(from, businessPhoneNumberId, "user", text);
  addMessage(from, businessPhoneNumberId, "assistant", response);
  await sendTextMessage(businessPhoneNumberId, from, response);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "whatsapp-agent" });
});

app.listen(port, () => {
  console.log(`WhatsApp agent running on http://localhost:${port}`);
});

export default app;
