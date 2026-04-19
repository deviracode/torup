/**
 * Outbound message sending via Meta WhatsApp Cloud API.
 */

const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

interface SendResult {
  messaging_product: string;
  contacts: { wa_id: string }[];
  messages: { id: string }[];
}

async function callApi(
  phoneNumberId: string,
  body: Record<string, unknown>
): Promise<SendResult | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error("WHATSAPP_ACCESS_TOKEN not set");
    return null;
  }

  try {
    const res = await fetch(
      `${GRAPH_API_URL}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          ...body,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("WhatsApp API error:", err);
      return null;
    }

    return res.json() as Promise<SendResult>;
  } catch (err) {
    console.error("WhatsApp API call failed:", err);
    return null;
  }
}

/**
 * Send a plain text message.
 */
export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string
): Promise<SendResult | null> {
  return callApi(phoneNumberId, {
    to,
    type: "text",
    text: { body: text },
  });
}

/**
 * Send an interactive button message (up to 3 buttons).
 */
export async function sendButtonMessage(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
): Promise<SendResult | null> {
  return callApi(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/**
 * Send an interactive list message (for service selection etc).
 */
export async function sendListMessage(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[]
): Promise<SendResult | null> {
  return callApi(phoneNumberId, {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonText.slice(0, 20),
        sections,
      },
    },
  });
}

/**
 * Mark a message as read.
 */
export async function markAsRead(
  phoneNumberId: string,
  messageId: string
): Promise<void> {
  await callApi(phoneNumberId, {
    status: "read",
    message_id: messageId,
  });
}
