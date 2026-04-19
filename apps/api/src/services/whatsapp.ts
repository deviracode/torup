const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

interface WhatsAppResponse {
  messages?: { id: string }[];
}

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<string | null> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[WhatsApp] (dev mode) To: ${to}, Message: ${body}`);
    return null;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^0-9]/g, ""),
        type: "text",
        text: { body },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;
  return data.messages?.[0]?.id ?? null;
}

export async function sendInteractiveReminder(
  to: string,
  body: string,
  language: string
): Promise<string | null> {
  const confirmLabel = language === "ar" ? "تأكيد ✓" : language === "en" ? "Confirm ✓" : "אישור ✓";
  const cancelLabel = language === "ar" ? "إلغاء ✗" : language === "en" ? "Cancel ✗" : "ביטול ✗";

  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log(`[WhatsApp] (dev mode) Interactive reminder to: ${to}, Message: ${body}, Buttons: [${confirmLabel}, ${cancelLabel}]`);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^0-9]/g, ""),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: [
              { type: "reply", reply: { id: "confirm", title: confirmLabel } },
              { type: "reply", reply: { id: "cancel", title: cancelLabel } },
            ],
          },
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;
  return data.messages?.[0]?.id ?? null;
}
