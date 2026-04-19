import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { createServiceClient } from "../lib/supabase.js";
import { validateTransition } from "@queue/shared";
import { sendWhatsAppMessage } from "../services/whatsapp.js";

const router: ReturnType<typeof Router> = Router();

const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "queuepro_verify";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";

function verifySignature(req: Request): boolean {
  if (!APP_SECRET) return true;
  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(JSON.stringify(req.body)).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const responseMessages: Record<string, Record<string, string>> = {
  confirmed: {
    he: "התור שלך אושר! נתראה.",
    ar: "تم تأكيد موعدك! نراك هناك.",
    en: "Your appointment is confirmed! See you there.",
  },
  cancelled: {
    he: "התור שלך בוטל. תוכל לקבוע תור חדש בכל עת.",
    ar: "تم إلغاء موعدك. يمكنك حجز موعد جديد في أي وقت.",
    en: "Your appointment has been cancelled. You can rebook anytime.",
  },
  already_confirmed: {
    he: "התור שלך כבר מאושר.",
    ar: "موعدك مؤكد بالفعل.",
    en: "Your appointment is already confirmed.",
  },
  invalid_transition: {
    he: "לא ניתן לשנות את סטטוס התור כרגע.",
    ar: "لا يمكن تغيير حالة الموعد حاليا.",
    en: "This appointment can no longer be modified.",
  },
};

// GET /api/webhooks/whatsapp - Meta verification challenge
router.get("/whatsapp", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST /api/webhooks/whatsapp - Incoming messages & status updates
router.post("/whatsapp", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifySignature(req)) {
      res.sendStatus(403);
      return;
    }

    res.sendStatus(200);

    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) return;

    for (const message of value.messages) {
      if (message.type !== "interactive" || !message.interactive?.button_reply) continue;

      const buttonId = message.interactive.button_reply.id;
      const from = message.from;

      if (buttonId !== "confirm" && buttonId !== "cancel") continue;

      await handleButtonResponse(from, buttonId);
    }
  } catch (err) {
    console.error("[Webhook] Error processing:", err);
  }
});

async function handleButtonResponse(customerPhone: string, action: "confirm" | "cancel") {
  const supabase = createServiceClient();

  const { data: logEntry } = await supabase
    .from("notifications_log")
    .select("appointment_id, business_id, customer_id")
    .eq("channel", "whatsapp")
    .like("template_id", "reminder_%")
    .not("whatsapp_message_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(10);

  if (!logEntry || logEntry.length === 0) return;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, language_preference")
    .eq("phone", customerPhone)
    .single();

  if (!customer) return;

  const entry = logEntry.find((e: Record<string, unknown>) => e.customer_id === customer.id);
  if (!entry || !entry.appointment_id) return;

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("id", entry.appointment_id)
    .single();

  if (!appointment) return;

  const lang = customer.language_preference || "he";
  const newStatus = action === "confirm" ? "confirmed" : "cancelled";

  if (appointment.status === newStatus) {
    await sendWhatsAppMessage(customerPhone, responseMessages.already_confirmed[lang]);
    return;
  }

  if (!validateTransition(appointment.status, newStatus)) {
    await sendWhatsAppMessage(customerPhone, responseMessages.invalid_transition[lang]);
    return;
  }

  await supabase
    .from("appointments")
    .update({ status: newStatus })
    .eq("id", appointment.id);

  await supabase
    .from("notifications_log")
    .update({ customer_response: newStatus, responded_at: new Date().toISOString() })
    .eq("appointment_id", appointment.id)
    .like("template_id", "reminder_%")
    .order("sent_at", { ascending: false })
    .limit(1);

  await sendWhatsAppMessage(customerPhone, responseMessages[newStatus][lang]);
}

export default router;
