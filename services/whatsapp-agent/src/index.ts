import express, { type Express } from "express";
import { verifySignature, parseWebhookPayload } from "./webhook.js";
import {
  getSession,
  createSession,
  updateSession,
  addMessage,
  type ConversationSession,
} from "./session.js";
import { detectLanguage } from "./language.js";
import { processMessage } from "./agent.js";
import { sendTextMessage, sendButtonMessage, sendListMessage, markAsRead } from "./whatsapp-api.js";
import { extractBookingIntent, type BookingIntent } from "./intent.js";
import { createClient } from "@torup/db";

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
async function resolveBusinessId(phoneNumberId: string): Promise<{ businessId: string; businessName: string; phone: string; allowMultipleBookings: boolean } | null> {
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
    .select("id, name, phone, allow_multiple_bookings")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (data) return { businessId: data.id, businessName: data.name, phone: data.phone, allowMultipleBookings: data.allow_multiple_bookings };
  return null;
}

async function getBusinessServices(businessId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const { data } = await supabase
    .from("services")
    .select("id, name_he, name_ar, name_en, duration_minutes, price, price_type")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("sort_order");

  return data || [];
}

// Cache business info + services + booking rules (5 min TTL)
const bizCache = new Map<string, { biz: { businessId: string; businessName: string; phone: string; allowMultipleBookings: boolean }; services: Record<string, any>[]; maxFutureDays: number; expiresAt: number }>();

async function getCachedBusinessContext(businessPhoneNumberId: string) {
  const cached = bizCache.get(businessPhoneNumberId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const biz = await resolveBusinessId(businessPhoneNumberId);
  if (!biz) return null;

  const supabase = createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  const [services, rulesResult] = await Promise.all([
    getBusinessServices(biz.businessId),
    supabase
      .from("booking_rules")
      .select("max_future_days")
      .eq("business_id", biz.businessId)
      .single(),
  ]);

  const maxFutureDays = rulesResult.data?.max_future_days ?? 30;
  const entry = { biz, services, maxFutureDays, expiresAt: Date.now() + 5 * 60 * 1000 };
  bizCache.set(businessPhoneNumberId, entry);
  return entry;
}

const MAIN_MENU_I18N: Record<"he" | "ar" | "en", {
  greeting: (name: string | undefined, biz: string) => string;
  book: string; myAppts: string; cancel: string;
}> = {
  he: {
    greeting: (n, b) => n ? `שלום ${n}! 👋\nברוכים הבאים ל${b}.\nאיך אפשר לעזור?` : `ברוכים הבאים ל${b}! 👋\nאיך אפשר לעזור?`,
    book: "קביעת תור", myAppts: "התורים שלי", cancel: "ביטול תור",
  },
  ar: {
    greeting: (n, b) => n ? `أهلين ${n}! 👋\nمرحبتين بـ${b}.\nشو بدك؟` : `أهلين بـ${b}! 👋\nشو بدك؟`,
    book: "احجز دور", myAppts: "دواراتي", cancel: "إلغي الدور",
  },
  en: {
    greeting: (n, b) => n ? `Hi ${n}! 👋\nWelcome to ${b}.\nHow can I help?` : `Welcome to ${b}! 👋\nHow can I help?`,
    book: "Book Appointment", myAppts: "My Appointments", cancel: "Cancel Appointment",
  },
};

async function sendMainMenu(
  phoneNumberId: string,
  to: string,
  businessName: string,
  customerName?: string,
  language: "he" | "ar" | "en" = "he"
) {
  const i18n = MAIN_MENU_I18N[language];
  await sendButtonMessage(phoneNumberId, to, i18n.greeting(customerName, businessName), [
    { id: "menu_book", title: i18n.book },
    { id: "menu_my_appointments", title: i18n.myAppts },
    { id: "menu_cancel", title: i18n.cancel },
  ]);
}

function normalizePhone(p: string): string {
  return p.startsWith("972") ? "0" + p.slice(3) : p;
}

const ASK_NAME: Record<"he" | "ar" | "en", string> = {
  he: "שמחים שפניתם! 🙂 איך קוראים לכם? (שם מלא יעזור לבעל העסק לזהות אתכם)",
  ar: "أهلين! 🙂 ممكن تكتبي شو اسمك؟ (الاسم الكامل بساعد صاحب المحل يتعرف عليك)",
  en: "Welcome! 🙂 What's your name? (Full name helps the business owner identify you)",
};

const NAME_THANKS: Record<"he" | "ar" | "en", (n: string) => string> = {
  he: (n) => `תודה ${n}! 🙏`,
  ar: (n) => `يسلمو ${n}! 🙏`,
  en: (n) => `Thanks ${n}! 🙏`,
};

const PENDING_APPROVAL_MSG: Record<"he" | "ar" | "en", (svc: string, dateLabel: string, time: string) => string> = {
  he: (svc, d, t) =>
    `📩 בקשת התור התקבלה!\n\n✂️ ${svc}\n📅 ${d}\n🕐 ${t}\n\n⏳ ממתין לאישור בעל העסק. נשלח לך הודעה ברגע שזה יאושר.`,
  ar: (svc, d, t) =>
    `📩 وصلنا طلبك!\n\n✂️ ${svc}\n📅 ${d}\n🕐 ${t}\n\n⏳ بننتظر موافقة صاحب المحل. رح نبعتلك رسالة لما يوافق.`,
  en: (svc, d, t) =>
    `📩 Your booking request was received!\n\n✂️ ${svc}\n📅 ${d}\n🕐 ${t}\n\n⏳ Awaiting the business owner's approval. We'll message you the moment it's approved.`,
};

const CHAIN_BOOKING_MSG: Record<"he" | "ar" | "en", (remaining: number) => string> = {
  he: (n) => `רוצים לקבוע תור לעוד ${n} ${n === 1 ? "אדם" : "אנשים"}?`,
  ar: (n) => `بدك تحجزي دور لـ ${n} ${n === 1 ? "شخص ثاني" : "أشخاص ثانيين"} كمان؟`,
  en: (n) => `Want to book for ${n} more ${n === 1 ? "person" : "people"}?`,
};

const ALREADY_BOOKED_MSG: Record<"he" | "ar" | "en", string> = {
  he: "יש לך כבר תור פעיל אצלנו 📌\nניתן לקבוע תור חדש רק לאחר שהתור הקיים יסתיים או יבוטל. אפשר לראות את התור ב\"התורים שלי\".",
  ar: "عندك دور شاغل هلأ 📌\nتقدري تحجزي دور جديد بس بعد ما ينتهي أو يتلغى الدور الحالي. تقدري تشوفيه من \"دواراتي\".",
  en: "You already have an active booking 📌\nYou can request a new appointment only after the existing one ends or is cancelled. View it under \"My Appointments\".",
};

const SLOT_TAKEN_MSG: Record<"he" | "ar" | "en", (time: string, date: string) => string> = {
  he: (t, d) => `⚠️ השעה ${t}:00 ב-${d} תפוסה. בחרו תאריך אחר:`,
  ar: (t, d) => `⚠️ الساعة ${t}:00 يوم ${d} مأخوذة. اختاري تاريخ ثاني:`,
  en: (t, d) => `⚠️ ${t}:00 on ${d} is taken. Choose another date:`,
};

const SERVICE_LIST_I18N: Record<"he" | "ar" | "en", { prompt: string; button: string; section: string; discuss: string; min: string }> = {
  he: { prompt: "בחרו שירות:", button: "הצג שירותים", section: "שירותים", discuss: "לשיחה עם בעל העסק", min: "דק׳" },
  ar: { prompt: "شو بدك تعملي؟", button: "شوفي الخدمات", section: "الخدمات", discuss: "اتفقي مع صاحب المحل", min: "دقيقة" },
  en: { prompt: "Choose a service:", button: "Show Services", section: "Services", discuss: "Discuss with owner", min: "min" },
};

async function sendServiceList(phoneNumberId: string, to: string, services: Record<string, any>[], language: "he" | "ar" | "en" = "he") {
  const i18n = SERVICE_LIST_I18N[language];
  const rows = services.map((s: any) => {
    const name = (language === "ar" && s.name_ar ? s.name_ar : language === "en" && s.name_en ? s.name_en : s.name_he) || s.name_he || "";
    return {
      id: `service_${s.id || s.name_he}`,
      title: name.slice(0, 24),
      description: s.price_type === "discuss"
        ? `${s.duration_minutes} ${i18n.min} • ${i18n.discuss}`
        : `${s.duration_minutes} ${i18n.min} • ₪${s.price}`,
    };
  });

  const displayRows = rows.slice(0, 10);
  await sendListMessage(phoneNumberId, to, i18n.prompt, i18n.button, [{ title: i18n.section, rows: displayRows }]);
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

const DAY_NAMES: Record<"he" | "ar" | "en", string[]> = {
  he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const TODAY_LABEL: Record<"he" | "ar" | "en", string> = { he: "היום", ar: "اليوم", en: "Today" };
const TOMORROW_LABEL: Record<"he" | "ar" | "en", string> = { he: "מחר", ar: "بكرا", en: "Tomorrow" };
const DAY_PREFIX: Record<"he" | "ar" | "en", string> = { he: "יום", ar: "يوم", en: "" };
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

async function findNextAvailableDates(businessId: string, serviceId: string, maxDays = 14, language: "he" | "ar" | "en" = "he"): Promise<{ date: string; label: string }[]> {
  const results: { date: string; label: string }[] = [];

  for (let i = 0; i < maxDays && results.length < 5; i++) {
    const { dateStr, day: dow } = addDaysIsrael(i);

    const slots = await getAvailableTimeSlots(businessId, serviceId, dateStr);
    if (slots.length === 0) continue;

    let label: string;
    const dateShort = dateStr.slice(5).replace("-", "/");
    if (i === 0) label = TODAY_LABEL[language];
    else if (i === 1) label = TOMORROW_LABEL[language];
    else {
      const prefix = DAY_PREFIX[language];
      const dayName = DAY_NAMES[language][dow];
      label = prefix ? `${prefix} ${dayName} (${dateShort})` : `${dayName} (${dateShort})`;
    }

    results.push({ date: dateStr, label });
  }

  return results;
}

async function getAvailableTimeSlots(businessId: string, serviceId: string, date: string): Promise<{ time: string; label: string }[]> {
  const supabase = getSupabase();
  const d = new Date(date + "T12:00:00Z");
  const { day: dayOfWeek } = getIsraelDate(d);

  const [hoursRes, serviceRes, aptsRes, gcalRes, breaksRes] = await Promise.all([
    supabase.from("working_hours").select("start_time, end_time, is_closed")
      .eq("business_id", businessId).eq("day_of_week", dayOfWeek).is("staff_id", null),
    supabase.from("services").select("duration_minutes, buffer_minutes, max_capacity")
      .eq("id", serviceId).single(),
    supabase.from("appointments").select("start_time, end_time")
      .eq("business_id", businessId).eq("service_id", serviceId)
      .gte("start_time", `${date}T00:00:00`).lt("start_time", `${date}T23:59:59`)
      .in("status", ["pending", "confirmed", "in_progress"]),
    supabase.from("google_calendar_events").select("start_time, end_time")
      .eq("business_id", businessId)
      .gte("start_time", `${date}T00:00:00`).lt("start_time", `${date}T23:59:59`),
    supabase.from("breaks").select("type, day_of_week, specific_date, start_time, end_time")
      .eq("business_id", businessId).is("staff_id", null),
  ]);

  // Merge Google Calendar events into conflict detection
  const allConflicts = (aptsRes.data || []).concat(
    (gcalRes.data || []).map((e: any) => ({ start_time: e.start_time, end_time: e.end_time }))
  );

  const wh = hoursRes.data?.[0];
  const service = serviceRes.data;
  if (!wh || wh.is_closed || !service) return [];

  // Check applicable breaks for this date
  const applicableBreaks = (breaksRes.data || []).filter((b: any) => {
    if (b.type === "recurring" && b.day_of_week === dayOfWeek) return true;
    if (b.type === "one_time" && b.specific_date === date) return true;
    return false;
  });

  // Check full-day block
  const isFullDayBlocked = applicableBreaks.some(
    (b: any) => b.start_time <= "00:01" && b.end_time >= "23:58"
  );
  if (isFullDayBlocked) return [];

  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

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

  for (let m = startMin; m + duration <= endMin; m += step) {
    if (isToday && m <= nowMinutes) continue;

    // Check if slot overlaps any break
    const slotEnd = m + duration;
    const blockedByBreak = applicableBreaks.some((b: any) => {
      const bStart = toMin(b.start_time);
      const bEnd = toMin(b.end_time);
      return m < bEnd && slotEnd > bStart;
    });
    if (blockedByBreak) continue;

    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const endHH = String(Math.floor(slotEnd / 60)).padStart(2, "0");
    const endMM = String(slotEnd % 60).padStart(2, "0");
    const slotStart = `${date}T${hh}:${mm}:00${tzOffset}`;
    const slotEndStr = `${date}T${endHH}:${endMM}:00${tzOffset}`;

    const slotStartUTC = new Date(slotStart).toISOString();
    const slotEndUTC = new Date(slotEndStr).toISOString();

    const conflicts = allConflicts.filter((a: any) => a.start_time < slotEndUTC && a.end_time > slotStartUTC);
    if (conflicts.length < (service.max_capacity || 1)) {
      slots.push({ time: slotStartUTC, label: `${hh}:${mm}` });
    }
  }

  return slots;
}

async function createBooking(
  businessId: string,
  serviceId: string,
  startTime: string,
  customerId: string,
  allowMultipleBookings: boolean
): Promise<"ok" | "already_booked" | string> {
  const supabase = getSupabase();

  const { data: service } = await supabase.from("services")
    .select("duration_minutes").eq("id", serviceId).single();
  if (!service) return "שגיאה: שירות לא נמצא";

  if (!allowMultipleBookings) {
    // Single-active-appointment cap: reject if customer already has any active future
    // appointment at this business.
    // Advisory lock prevents the race where two simultaneous inserts from the same
    // customer both pass the count check before either writes.
    await supabase.rpc("acquire_booking_lock", { biz_id: businessId, cust_id: customerId });
    const { count: activeCount, error: countErr } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .in("status", ["pending_approval", "pending", "confirmed"])
      .gt("start_time", new Date().toISOString());
    if (countErr) return `שגיאה: ${countErr.message}`;
    if ((activeCount ?? 0) > 0) return "already_booked";
  }

  const endTime = new Date(
    new Date(startTime).getTime() + service.duration_minutes * 60000
  ).toISOString();

  const { data: inserted, error } = await supabase.from("appointments").insert({
    business_id: businessId,
    service_id: serviceId,
    customer_id: customerId,
    start_time: startTime,
    end_time: endTime,
    status: "pending_approval",
    created_via: "whatsapp",
  }).select("id").single();

  if (error) return `שגיאה: ${error.message}`;

  // Fire-and-forget manager notification
  if (inserted?.id) {
    const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:3001";
    const secret = process.env.INTERNAL_SECRET || "";
    fetch(`${apiUrl}/api/internal/notify-manager`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ appointmentId: inserted.id }),
    }).catch(() => {});
  }

  return "ok";
}

/**
 * Look up or create a customer row by phone. Returns { id, name } where name
 * may be empty for fresh-or-name-less rows. Caller is responsible for asking
 * the customer for their name when name is empty.
 */
async function loadOrInitCustomer(
  phone: string,
  language: "he" | "ar" | "en"
): Promise<{ id: string; name: string } | null> {
  const supabase = getSupabase();
  const normalized = normalizePhone(phone);

  const { data: existing } = await supabase
    .from("customers")
    .select("id, name")
    .eq("phone", normalized)
    .maybeSingle();

  if (existing) return { id: existing.id, name: existing.name || "" };

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ phone: normalized, name: "", language_preference: language })
    .select("id, name")
    .single();
  if (error || !created) return null;
  return { id: created.id, name: created.name || "" };
}

async function updateCustomerName(customerId: string, name: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("customers").update({ name }).eq("id", customerId);
}

const TIME_GROUP_LABELS: Record<"he" | "ar" | "en", Record<string, string>> = {
  he: { morning: "☀️ בוקר", noon: "🌤️ צהריים", evening: "🌙 אחה\"צ/ערב" },
  ar: { morning: "☀️ الصبح", noon: "🌤️ الضهر", evening: "🌙 العصر/المسا" },
  en: { morning: "☀️ Morning", noon: "🌤️ Noon", evening: "🌙 Evening" },
};

const TIME_SLOTS_I18N: Record<"he" | "ar" | "en", { chooseTime: string; showTimes: string; choosePartOfDay: string; noSlots: string }> = {
  he: { chooseTime: "בחרו שעה:", showTimes: "הצג שעות", choosePartOfDay: "בחרו חלק ביום:", noSlots: "אין שעות פנויות בתאריך הזה 😔\nנסו תאריך אחר." },
  ar: { chooseTime: "اختاري الوقت:", showTimes: "شوفي المواعيد", choosePartOfDay: "إيمتى بدك؟", noSlots: "ما في مواعيد فاضية هاليوم 😔\nجربي يوم ثاني." },
  en: { chooseTime: "Choose a time:", showTimes: "Show Times", choosePartOfDay: "Choose time of day:", noSlots: "No slots available on this date 😔\nTry another date." },
};

const BOOKING_FLOW_I18N: Record<"he" | "ar" | "en", {
  howPickDate: string; quickDates: string; specificDate: string;
  typeDate: string; noDates: string; chooseDate: string;
  summary: (svc: string, date: string, time: string) => string;
  confirmYes: string; confirmNo: string;
  pastDate: string; noSlotsDate: string;
  discussService: (url: string) => string;
  cantChangeStatus: string;
}> = {
  he: {
    howPickDate: "איך תרצו לבחור תאריך?",
    quickDates: "📅 התאריכים הקרובים", specificDate: "📆 תאריך אחר",
    typeDate: "הקלידו תאריך בפורמט DD/MM/YYYY (לדוגמה: 30/12/2026)",
    noDates: "אין תאריכים פנויים בשבועיים הקרובים 😔",
    chooseDate: "בחרו תאריך:",
    summary: (s, d, t) => `📋 סיכום הזמנה:\n✂️ ${s}\n📅 ${d}\n🕐 ${t}\n\nלאשר?`,
    confirmYes: "✅ אישור", confirmNo: "❌ ביטול",
    pastDate: "לא ניתן לקבוע תור בתאריך שעבר. נסו תאריך עתידי.",
    noSlotsDate: "אין שעות פנויות בתאריך זה. נסו תאריך אחר.",
    discussService: (url) => `שירות זה דורש תיאום עם בעל העסק.\n📞 צרו קשר בוואטסאפ: https://wa.me/${url}`,
    cantChangeStatus: "לא ניתן לשנות את סטטוס התור כרגע.",
  },
  ar: {
    howPickDate: "كيف بدك تختاري التاريخ؟",
    quickDates: "📅 أقرب المواعيد", specificDate: "📆 تاريخ ثاني",
    typeDate: "اكتبي التاريخ بهالشكل DD/MM/YYYY (مثال: 30/12/2026)",
    noDates: "ما في مواعيد فاضية بالأسبوعين الجايين 😔",
    chooseDate: "اختاري التاريخ:",
    summary: (s, d, t) => `📋 ملخص الحجز:\n✂️ ${s}\n📅 ${d}\n🕐 ${t}\n\nبتأكدي؟`,
    confirmYes: "✅ آه، أكيد", confirmNo: "❌ لا، إلغي",
    pastDate: "ما بنقدر نحجز بتاريخ فات. جربي تاريخ جاي.",
    noSlotsDate: "ما في مواعيد فاضية هاليوم. جربي يوم ثاني.",
    discussService: (url) => `هالخدمة بتحتاج تتفقي مع صاحب المحل.\n📞 تواصلي عبر واتساب: https://wa.me/${url}`,
    cantChangeStatus: "ما بنقدر نغير الدور هلأ.",
  },
  en: {
    howPickDate: "How would you like to pick a date?",
    quickDates: "📅 Next Available", specificDate: "📆 Specific Date",
    typeDate: "Enter a date in DD/MM/YYYY format (e.g. 30/12/2026)",
    noDates: "No available dates in the next two weeks 😔",
    chooseDate: "Choose a date:",
    summary: (s, d, t) => `📋 Booking Summary:\n✂️ ${s}\n📅 ${d}\n🕐 ${t}\n\nConfirm?`,
    confirmYes: "✅ Confirm", confirmNo: "❌ Cancel",
    pastDate: "Can't book a past date. Try a future date.",
    noSlotsDate: "No slots available on this date. Try another date.",
    discussService: (url) => `This service requires coordination with the owner.\n📞 Contact via WhatsApp: https://wa.me/${url}`,
    cantChangeStatus: "Can't change the appointment status right now.",
  },
};

export function groupTimeSlots(slots: { time: string; label: string }[]): Record<string, { time: string; label: string }[]> {
  const groups: Record<string, { time: string; label: string }[]> = { morning: [], noon: [], evening: [] };
  for (const slot of slots) {
    const h = parseInt(slot.label.split(":")[0], 10);
    if (h >= 6 && h < 12) groups.morning.push(slot);
    else if (h >= 12 && h < 16) groups.noon.push(slot);
    else groups.evening.push(slot);
  }
  return groups;
}

async function sendTimeSlotsGrouped(
  phoneNumberId: string,
  to: string,
  serviceName: string,
  date: string,
  slots: { time: string; label: string }[],
  language: "he" | "ar" | "en" = "he"
) {
  const grouped = groupTimeSlots(slots);
  const labels = TIME_GROUP_LABELS[language];
  const i18n = TIME_SLOTS_I18N[language];
  const sections: { title: string; rows: { id: string; title: string }[] }[] = [];

  for (const [key, label] of Object.entries(labels)) {
    const groupSlots = grouped[key] || [];
    if (groupSlots.length === 0) continue;
    sections.push({
      title: label,
      rows: groupSlots.slice(0, 10).map((s) => ({ id: `time_${s.time}`, title: s.label })),
    });
  }

  if (sections.length === 0) return;

  await sendListMessage(phoneNumberId, to,
    `${serviceName} • ${date.slice(5).replace("-", "/")}\n${i18n.chooseTime}`,
    i18n.showTimes,
    sections
  );
}

async function sendTimePeriodOrSlots(
  phoneNumberId: string,
  to: string,
  businessPhoneNumberId: string,
  session: ConversationSession,
  slots: { time: string; label: string }[]
): Promise<void> {
  const grouped = groupTimeSlots(slots);

  const periodOrder: Array<"morning" | "noon" | "evening"> = ["morning", "noon", "evening"];
  const nonEmpty = periodOrder.filter((k) => (grouped[k] || []).length > 0);

  if (nonEmpty.length === 0) return;

  const lang = session.language ?? "he";
  const i18n = TIME_SLOTS_I18N[lang];
  const labels = TIME_GROUP_LABELS[lang];

  if (nonEmpty.length === 1) {
    updateSession(to, businessPhoneNumberId, {
      booking: { ...session.booking!, step: "select_time" },
    });
    await sendTimeSlotsGrouped(phoneNumberId, to, session.booking!.serviceName, session.booking!.date!, grouped[nonEmpty[0]], lang);
    return;
  }

  updateSession(to, businessPhoneNumberId, {
    booking: { ...session.booking!, step: "select_time_period" },
  });

  const buttons = nonEmpty.map((k) => ({
    id: `period_${k}`,
    title: labels[k],
  }));

  await sendButtonMessage(
    phoneNumberId,
    to,
    `${session.booking!.serviceName} ✂️\n${session.booking!.date!.slice(5).replace("-", "/")}\n${i18n.choosePartOfDay}`,
    buttons
  );
}

async function resumeFromIntent(
  from: string,
  businessPhoneNumberId: string,
  session: ConversationSession,
  ctx: { biz: { businessId: string; businessName: string; phone: string; allowMultipleBookings: boolean }; services: Record<string, any>[]; maxFutureDays: number },
  intent: BookingIntent
) {
  const lang = session.language ?? "he";

  if (!intent.service_id) {
    await sendServiceList(businessPhoneNumberId, from, ctx.services, lang);
    return;
  }

  const service = ctx.services.find((s: any) => s.id === intent.service_id);
  if (!service) {
    await sendServiceList(businessPhoneNumberId, from, ctx.services, lang);
    return;
  }

  const serviceName =
    (lang === "ar" && service.name_ar
      ? service.name_ar
      : lang === "en" && service.name_en
      ? service.name_en
      : service.name_he) || service.name_he;

  updateSession(from, businessPhoneNumberId, {
    booking: { step: "select_date", serviceId: intent.service_id, serviceName },
  });

  if (!intent.date) {
    const bf = BOOKING_FLOW_I18N[lang];
    await sendButtonMessage(businessPhoneNumberId, from, `${serviceName} ✂️\n${bf.howPickDate}`, [
      { id: "flow_quick", title: bf.quickDates },
      { id: "flow_specific", title: bf.specificDate },
    ]);
    return;
  }

  const slots = await getAvailableTimeSlots(ctx.biz.businessId, intent.service_id, intent.date);

  if (slots.length === 0) {
    const bf = BOOKING_FLOW_I18N[lang];
    await sendTextMessage(businessPhoneNumberId, from, bf.noDates);
    const dates = await findNextAvailableDates(ctx.biz.businessId, intent.service_id, ctx.maxFutureDays, lang);
    if (dates.length > 0) {
      await sendButtonMessage(businessPhoneNumberId, from, `${serviceName} ✂️\n${bf.chooseDate}`,
        dates.map((d) => ({ id: `date_${d.date}`, title: d.label }))
      );
    }
    return;
  }

  if (intent.time_hour === null) {
    updateSession(from, businessPhoneNumberId, {
      booking: { step: "select_date", serviceId: intent.service_id, serviceName, date: intent.date },
    });
    const updatedSession = { ...session, booking: { step: "select_date" as const, serviceId: intent.service_id, serviceName, date: intent.date } };
    await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, slots);
    return;
  }

  const exactSlot = slots.find((s) => {
    const ilParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jerusalem",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date(s.time));
    const h = Number(ilParts.find((p) => p.type === "hour")?.value ?? -1);
    return h === intent.time_hour;
  });

  if (!exactSlot) {
    const dateDisplay = intent.date.slice(5).replace("-", "/");
    await sendTextMessage(businessPhoneNumberId, from, SLOT_TAKEN_MSG[lang](String(intent.time_hour), dateDisplay));
    const bf = BOOKING_FLOW_I18N[lang];
    const dates = await findNextAvailableDates(ctx.biz.businessId, intent.service_id, ctx.maxFutureDays, lang);
    if (dates.length > 0) {
      await sendButtonMessage(businessPhoneNumberId, from, `${serviceName} ✂️\n${bf.chooseDate}`,
        dates.map((d) => ({ id: `date_${d.date}`, title: d.label }))
      );
    }
    return;
  }

  if (intent.party_size > 1) {
    updateSession(from, businessPhoneNumberId, { chainRemaining: intent.party_size - 1 });
  }

  updateSession(from, businessPhoneNumberId, {
    booking: { step: "confirm", serviceId: intent.service_id, serviceName, date: intent.date, time: exactSlot.time },
  });

  const timeLabel = new Date(exactSlot.time).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  });

  const bfConf = BOOKING_FLOW_I18N[lang];
  await sendButtonMessage(businessPhoneNumberId, from,
    bfConf.summary(serviceName, intent.date.slice(5).replace("-", "/"), timeLabel),
    [
      { id: "confirm_yes", title: bfConf.confirmYes },
      { id: "confirm_no", title: bfConf.confirmNo },
    ]
  );
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

  // Re-detect language on every free-text message so switching languages works
  if (!interactionId) {
    const detectedLang = detectLanguage(text);
    if (detectedLang !== session.language) {
      session.language = detectedLang;
      updateSession(from, businessPhoneNumberId, { language: detectedLang });
      if (session.customerId) {
        void getSupabase().from("customers").update({ language_preference: detectedLang }).eq("id", session.customerId);
      }
    }
  }

  // --- Customer identification (run once per session) ---
  const wasAwaitingName = session.awaitingName;

  if (!session.customerId) {
    const customer = await loadOrInitCustomer(from, session.language);
    if (customer) {
      session.customerId = customer.id;
      session.customerName = customer.name;
      if (!customer.name) session.awaitingName = true;
      updateSession(from, businessPhoneNumberId, {
        customerId: customer.id,
        customerName: customer.name,
        awaitingName: !customer.name,
      });
    }
  }

  // If awaitingName was just set THIS request (new customer), extract intent for later
  // and ask for name — do NOT treat the current message as the name answer
  if (!wasAwaitingName && session.awaitingName && !interactionId && session.customerId) {
    if (!session.booking) {
      const { dateStr: todayDate } = getIsraelDate();
      const intent = await extractBookingIntent(text, ctx.services as any, session.language, todayDate);
      if (intent.confidence === "high") {
        updateSession(from, businessPhoneNumberId, { pendingIntent: intent });
        session.pendingIntent = intent;
      }
    }
    await sendTextMessage(businessPhoneNumberId, from, ASK_NAME[session.language]);
    return;
  }

  // --- Free-text date input for specific booking flow ---
  if (session.booking?.step === "select_date" && session.bookingFlow === "specific" && !interactionId) {
    const dateMatch = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dateMatch) {
      await sendTextMessage(businessPhoneNumberId, from, "פורמט לא תקין. הקלידו תאריך בפורמט DD/MM/YYYY (לדוגמה: 30/12/2026)");
      return;
    }

    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = parseInt(dateMatch[3], 10);
    const inputDate = new Date(year, month - 1, day);

    if (isNaN(inputDate.getTime())) {
      await sendTextMessage(businessPhoneNumberId, from, "תאריך לא תקין. נסו שוב.");
      return;
    }

    const today = getIsraelDate();
    const inputDateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (inputDateStr < today.dateStr) {
      await sendTextMessage(businessPhoneNumberId, from, BOOKING_FLOW_I18N[session.language ?? "he"].pastDate);
      return;
    }

    const maxFutureDays = ctx.maxFutureDays ?? 30;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxFutureDays);
    if (inputDate > maxDate) {
      await sendTextMessage(businessPhoneNumberId, from, `ניתן לקבוע תור עד ${maxFutureDays} ימים מראש. נסו תאריך קרוב יותר.`);
      return;
    }

    const dateSlots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, inputDateStr);
    if (dateSlots.length === 0) {
      await sendTextMessage(businessPhoneNumberId, from, BOOKING_FLOW_I18N[session.language ?? "he"].noSlotsDate);
      return;
    }

    updateSession(from, businessPhoneNumberId, {
      booking: { ...session.booking, date: inputDateStr },
    });
    const updatedSession = { ...session, booking: { ...session.booking, date: inputDateStr } };
    await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, dateSlots);
    return;
  }

  // --- Name capture: if we previously asked, treat this text as the name ---
  if (session.awaitingName && !interactionId && session.customerId) {
    const candidate = text.trim();
    // Reject silly inputs (numbers/emoji-only); ask once more if invalid.
    if (candidate.length >= 2 && /[\p{L}]/u.test(candidate)) {
      await updateCustomerName(session.customerId, candidate);
      session.customerName = candidate;
      session.awaitingName = false;
      updateSession(from, businessPhoneNumberId, {
        customerName: candidate,
        awaitingName: false,
      });
      await sendTextMessage(
        businessPhoneNumberId,
        from,
        NAME_THANKS[session.language](candidate)
      );

      // Resume pending intent if one was saved before name was known
      if (session.pendingIntent) {
        const intent = session.pendingIntent;
        updateSession(from, businessPhoneNumberId, { pendingIntent: undefined });
        const updatedSession = { ...session, customerName: candidate, awaitingName: false, pendingIntent: undefined };
        await resumeFromIntent(from, businessPhoneNumberId, updatedSession, ctx, intent);
        return;
      }

      await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, candidate, session.language ?? "he");
      return;
    }
    // Re-ask once and bail.
    await sendTextMessage(businessPhoneNumberId, from, ASK_NAME[session.language]);
    return;
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
              await sendTextMessage(businessPhoneNumberId, from, BOOKING_FLOW_I18N[session.language ?? "he"].cantChangeStatus);
            }
            return;
          }
        }
      }
      await sendTextMessage(businessPhoneNumberId, from, "לא נמצא תור מתאים. 🤔");
      return;
    }

    if (interactionId === "menu_book") {
      await sendServiceList(businessPhoneNumberId, from, ctx.services, session.language ?? "he");
      return;
    }

    if (interactionId === "menu_my_appointments" || interactionId === "menu_cancel") {
      const lang = session.language ?? "he";
      const myApptsPrompt: Record<"he" | "ar" | "en", string> = {
        he: "הראה לי את התורים שלי",
        ar: "ورجيني دواراتي",
        en: "Show me my appointments",
      };
      const cancelPrompt: Record<"he" | "ar" | "en", string> = {
        he: "אני רוצה לבטל תור",
        ar: "بدي إلغي الدور",
        en: "I want to cancel an appointment",
      };
      const prompt = interactionId === "menu_my_appointments" ? myApptsPrompt[lang] : cancelPrompt[lang];
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

    // Service selected → show available dates (or WhatsApp link for discuss-type)
    if (interactionId.startsWith("service_")) {
      const serviceId = interactionId.replace("service_", "");
      const serviceName = text;

      // Discuss-type services: redirect to business WhatsApp, no appointment created
      const service = ctx.services.find((s: any) => s.id === serviceId);
      if (service?.price_type === "discuss") {
        const bizWhatsApp = ctx.biz.phone.replace(/[^0-9]/g, "");
        const bf0 = BOOKING_FLOW_I18N[session.language ?? "he"];
        await sendTextMessage(businessPhoneNumberId, from, bf0.discussService(bizWhatsApp));
        await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName, session.language ?? "he");
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { step: "select_date", serviceId, serviceName },
      });

      const bf1 = BOOKING_FLOW_I18N[session.language ?? "he"];
      await sendButtonMessage(businessPhoneNumberId, from,
        `${serviceName} ✂️\n${bf1.howPickDate}`,
        [
          { id: "flow_quick", title: bf1.quickDates },
          { id: "flow_specific", title: bf1.specificDate },
        ]
      );
      return;
    }

    // Quick date flow — show 5 next available dates
    if (interactionId === "flow_quick" && session.booking?.step === "select_date") {
      updateSession(from, businessPhoneNumberId, { bookingFlow: "quick" });
      const dates = await findNextAvailableDates(ctx.biz.businessId, session.booking.serviceId, ctx.maxFutureDays, session.language ?? "he");

      const bf2 = BOOKING_FLOW_I18N[session.language ?? "he"];
      if (dates.length === 0) {
        await sendTextMessage(businessPhoneNumberId, from, bf2.noDates);
        return;
      }

      await sendButtonMessage(businessPhoneNumberId, from,
        `${session.booking.serviceName} ✂️\n${bf2.chooseDate}`,
        dates.map((d) => ({ id: `date_${d.date}`, title: d.label }))
      );
      return;
    }

    // Specific date flow — prompt for DD/MM/YYYY input
    if (interactionId === "flow_specific" && session.booking?.step === "select_date") {
      updateSession(from, businessPhoneNumberId, { bookingFlow: "specific" });
      await sendTextMessage(businessPhoneNumberId, from, BOOKING_FLOW_I18N[session.language ?? "he"].typeDate);
      return;
    }

    // Date selected → show available time slots (grouped by time of day)
    if (interactionId.startsWith("date_") && session.booking?.step === "select_date") {
      const date = interactionId.replace("date_", "");
      const slots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, date);

      const bf3 = BOOKING_FLOW_I18N[session.language ?? "he"];
      if (slots.length === 0) {
        await sendTextMessage(businessPhoneNumberId, from, TIME_SLOTS_I18N[session.language ?? "he"].noSlots);
        await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName, session.language ?? "he");
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, date },
      });
      const updatedSession = { ...session, booking: { ...session.booking, date } };
      await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, slots);
      return;
    }

    // Period selected → show time slots for that period only
    if (
      (interactionId === "period_morning" || interactionId === "period_noon" || interactionId === "period_evening") &&
      session.booking?.step === "select_time_period"
    ) {
      const period = interactionId.replace("period_", "") as "morning" | "noon" | "evening";
      const slots = await getAvailableTimeSlots(ctx.biz.businessId, session.booking.serviceId, session.booking.date!);
      const grouped = groupTimeSlots(slots);
      const periodSlots = grouped[period] || [];

      if (periodSlots.length === 0) {
        const remaining = slots;
        if (remaining.length === 0) {
          await sendTextMessage(businessPhoneNumberId, from, TIME_SLOTS_I18N[session.language ?? "he"].noSlots);
          updateSession(from, businessPhoneNumberId, { booking: undefined });
          await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName, session.language ?? "he");
          return;
        }
        const updatedSession = { ...session };
        await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, remaining);
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, step: "select_time" },
      });

      await sendTimeSlotsGrouped(businessPhoneNumberId, from, session.booking.serviceName, session.booking.date!, periodSlots, session.language ?? "he");
      return;
    }

    // Time selected → confirm
    if (interactionId.startsWith("time_") && session.booking?.step === "select_time") {
      const startTime = interactionId.replace("time_", "");
      const timeLabel = text;

      updateSession(from, businessPhoneNumberId, {
        booking: { ...session.booking, step: "confirm", time: startTime },
      });

      const bfConf = BOOKING_FLOW_I18N[session.language ?? "he"];
      await sendButtonMessage(businessPhoneNumberId, from,
        bfConf.summary(session.booking.serviceName, session.booking.date?.slice(5).replace("-", "/") ?? "", timeLabel),
        [
          { id: "confirm_yes", title: bfConf.confirmYes },
          { id: "confirm_no", title: bfConf.confirmNo },
        ]
      );
      return;
    }

    // Confirm booking
    if (interactionId === "confirm_yes" && session.booking?.step === "confirm" && session.booking.time) {
      // If for some reason we still don't have a customer id, ask for the name
      // first and abort this confirm — they can re-tap confirm.
      if (!session.customerId) {
        updateSession(from, businessPhoneNumberId, { awaitingName: true });
        session.awaitingName = true;
        await sendTextMessage(businessPhoneNumberId, from, ASK_NAME[session.language]);
        return;
      }

      const result = await createBooking(
        ctx.biz.businessId,
        session.booking.serviceId,
        session.booking.time,
        session.customerId,
        ctx.biz.allowMultipleBookings
      );

      if (result === "ok") {
        const timeLabel = new Date(session.booking.time).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Jerusalem",
        });
        const dateLabel = session.booking.date?.slice(5).replace("-", "/") || "";
        await sendTextMessage(
          businessPhoneNumberId,
          from,
          PENDING_APPROVAL_MSG[session.language](
            session.booking.serviceName,
            dateLabel,
            timeLabel
          )
        );

        // Party size chaining: offer to book for remaining people
        const chain = session.chainRemaining ?? 0;
        if (chain > 0) {
          updateSession(from, businessPhoneNumberId, { chainRemaining: chain - 1 });
          const lang = session.language ?? "he";
          await sendButtonMessage(businessPhoneNumberId, from,
            CHAIN_BOOKING_MSG[lang](chain),
            [
              { id: "chain_yes", title: lang === "ar" ? "آه، أكيد" : lang === "en" ? "Yes" : "כן" },
              { id: "chain_no", title: lang === "ar" ? "لا، يسلمو" : lang === "en" ? "No" : "לא" },
            ]
          );
        }
      } else if (result === "already_booked") {
        await sendTextMessage(businessPhoneNumberId, from, ALREADY_BOOKED_MSG[session.language]);
      } else {
        await sendTextMessage(businessPhoneNumberId, from, result);
      }

      updateSession(from, businessPhoneNumberId, { booking: undefined });
      return;
    }

    if (interactionId === "confirm_no") {
      updateSession(from, businessPhoneNumberId, { booking: undefined });
      await sendTextMessage(businessPhoneNumberId, from, "ההזמנה בוטלה. 👋");
      await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName, session.language ?? "he");
      return;
    }

    if (interactionId === "chain_yes" && session.booking) {
      const serviceId = session.booking.serviceId;
      const serviceName = session.booking.serviceName;
      const date = session.booking.date!;
      const lang = session.language ?? "he";

      const slots = await getAvailableTimeSlots(ctx.biz.businessId, serviceId, date);
      if (slots.length === 0) {
        const bf = BOOKING_FLOW_I18N[lang];
        await sendTextMessage(businessPhoneNumberId, from, bf.noDates);
        updateSession(from, businessPhoneNumberId, { booking: undefined, chainRemaining: undefined });
        await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName, lang);
        return;
      }

      updateSession(from, businessPhoneNumberId, {
        booking: { step: "select_date", serviceId, serviceName, date },
      });
      const updatedSession = { ...session, booking: { step: "select_date" as const, serviceId, serviceName, date } };
      await sendTimePeriodOrSlots(businessPhoneNumberId, from, businessPhoneNumberId, updatedSession, slots);
      return;
    }

    if (interactionId === "chain_no") {
      updateSession(from, businessPhoneNumberId, { booking: undefined, chainRemaining: undefined });
      await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName, session.language ?? "he");
      return;
    }
  }

  // Intent extraction: parse service/date/time from free-text (only when not mid-flow)
  if (!interactionId && !session.booking && !session.awaitingName) {
    const { dateStr: todayDate } = getIsraelDate();
    const intent = await extractBookingIntent(text, ctx.services as any, session.language, todayDate);

    if (intent.confidence === "high") {
      if (!session.customerName) {
        updateSession(from, businessPhoneNumberId, { awaitingName: true, pendingIntent: intent });
        session.awaitingName = true;
        await sendTextMessage(businessPhoneNumberId, from, ASK_NAME[session.language]);
        return;
      }
      await resumeFromIntent(from, businessPhoneNumberId, session, ctx, intent);
      return;
    }
    // confidence=low: fall through to normal greeting/booking pattern matching
  }

  // Greetings → show main menu (no Claude needed)
  const greetingPatterns = /^(שלום|היי|הי|בוקר טוב|ערב טוב|מה נשמע|הגעתי|לאן הגעתי|hi|hello|hey|مرحبا|اهلا)[\s?!]*$/i;
  if (greetingPatterns.test(text.trim())) {
    if (!session.customerName) {
      updateSession(from, businessPhoneNumberId, { awaitingName: true });
      session.awaitingName = true;
      await sendTextMessage(businessPhoneNumberId, from, ASK_NAME[session.language]);
      return;
    }
    await sendMainMenu(businessPhoneNumberId, from, ctx.biz.businessName, session.customerName, session.language ?? "he");
    return;
  }

  // Booking intent → redirect to structured button flow
  const bookingPatterns = /תור|הזמנ|לקבוע|לזמן|book|appointment|schedule|reserve|حجز|موعد|دور|بدي|بغي|نبي|احجز|حاجز|قص.*شعر|شعر.*قص|تسريح|صبغ.*شعر|شعر.*صبغ/i;
  if (bookingPatterns.test(text.trim())) {
    if (!session.customerName) {
      updateSession(from, businessPhoneNumberId, { awaitingName: true });
      session.awaitingName = true;
      await sendTextMessage(businessPhoneNumberId, from, ASK_NAME[session.language]);
      return;
    }
    await sendServiceList(businessPhoneNumberId, from, ctx.services, session.language ?? "he");
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

  // If Claude signals booking intent, redirect to structured service list
  if (response.trim() === "SHOW_BOOKING_MENU") {
    await sendServiceList(businessPhoneNumberId, from, ctx.services, session.language ?? "he");
    return;
  }

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
