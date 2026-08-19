/**
 * Outbound message sending via Meta WhatsApp Cloud API.
 */
import { createHmac } from "node:crypto";

const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

export interface WhatsAppCredential {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
}

interface SendResult {
  messaging_product: string;
  contacts: { wa_id: string }[];
  messages: { id: string }[];
}

async function callApi(
  credential: WhatsAppCredential,
  body: Record<string, unknown>
): Promise<SendResult | null> {
  if (!credential.accessToken) {
    console.error("No WhatsApp access token provided for", credential.phoneNumberId);
    return null;
  }

  try {
    const appsecretProof = createHmac("sha256", credential.appSecret)
      .update(credential.accessToken)
      .digest("hex");
    const res = await fetch(
      `${GRAPH_API_URL}/${credential.phoneNumberId}/messages?appsecret_proof=${appsecretProof}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential.accessToken}`,
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
  credential: WhatsAppCredential,
  to: string,
  text: string
): Promise<SendResult | null> {
  return callApi(credential, {
    to,
    type: "text",
    text: { body: text },
  });
}

/**
 * Send an interactive button message (up to 3 buttons).
 */
export async function sendButtonMessage(
  credential: WhatsAppCredential,
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
): Promise<SendResult | null> {
  return callApi(credential, {
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
  credential: WhatsAppCredential,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[]
): Promise<SendResult | null> {
  return callApi(credential, {
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
  credential: WhatsAppCredential,
  messageId: string
): Promise<void> {
  await callApi(credential, {
    status: "read",
    message_id: messageId,
  });
}
