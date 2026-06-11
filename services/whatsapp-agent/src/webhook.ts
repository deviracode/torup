import crypto from "crypto";

/**
 * Verify Meta WhatsApp Cloud API webhook signature.
 * The signature is sent in the X-Hub-Signature-256 header.
 */
export function verifySignature(
  payload: string | Buffer,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export interface WhatsAppStatusUpdate {
  messageId: string;
  status: "delivered" | "read" | "failed";
  error?: string;
}

/**
 * Parse delivery/read/failure status updates from Meta WhatsApp Cloud API webhook payload.
 * These arrive in `value.statuses` and are how silent send failures (e.g. messages
 * sent outside the 24-hour customer service window) surface — the send call itself
 * returns a message id even though delivery later fails.
 */
export function parseWebhookStatuses(
  body: Record<string, unknown>
): WhatsAppStatusUpdate[] {
  const updates: WhatsAppStatusUpdate[] = [];

  const entry = body.entry as Array<Record<string, unknown>> | undefined;
  if (!entry) return updates;

  for (const e of entry) {
    const changes = e.changes as Array<Record<string, unknown>> | undefined;
    if (!changes) continue;

    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const statuses = value.statuses as
        | Array<{
            id?: string;
            status?: string;
            errors?: { code?: number; title?: string; message?: string }[];
          }>
        | undefined;
      if (!statuses) continue;

      for (const s of statuses) {
        if (!s.id) continue;
        if (s.status === "delivered" || s.status === "read" || s.status === "failed") {
          const err = s.errors?.[0];
          updates.push({
            messageId: s.id,
            status: s.status,
            error: err ? `${err.code} ${err.title ?? ""}: ${err.message ?? ""}`.trim() : undefined,
          });
        }
      }
    }
  }

  return updates;
}

export interface WhatsAppMessage {
  from: string; // phone number
  text: string;
  messageId: string;
  timestamp: string;
  businessPhoneNumberId: string;
  interactionId?: string; // button reply id or list reply id
}

/**
 * Parse incoming webhook payload from Meta WhatsApp Cloud API.
 * Returns extracted messages or empty array if not a message event.
 */
export function parseWebhookPayload(
  body: Record<string, unknown>
): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];

  const entry = body.entry as Array<Record<string, unknown>> | undefined;
  if (!entry) return messages;

  for (const e of entry) {
    const changes = e.changes as Array<Record<string, unknown>> | undefined;
    if (!changes) continue;

    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const metadata = value.metadata as
        | { phone_number_id?: string }
        | undefined;
      const phoneNumberId = metadata?.phone_number_id || "";

      const msgs = value.messages as
        | Array<{
            from?: string;
            text?: { body?: string };
            interactive?: {
              type?: string;
              button_reply?: { id?: string; title?: string };
              list_reply?: { id?: string; title?: string };
            };
            id?: string;
            timestamp?: string;
            type?: string;
          }>
        | undefined;

      if (!msgs) continue;

      for (const msg of msgs) {
        if (msg.type === "text" && msg.text?.body) {
          messages.push({
            from: msg.from || "",
            text: msg.text.body,
            messageId: msg.id || "",
            timestamp: msg.timestamp || "",
            businessPhoneNumberId: phoneNumberId,
          });
        } else if (msg.type === "interactive") {
          const reply = msg.interactive?.button_reply || msg.interactive?.list_reply;
          if (reply) {
            messages.push({
              from: msg.from || "",
              text: reply.title || "",
              messageId: msg.id || "",
              timestamp: msg.timestamp || "",
              businessPhoneNumberId: phoneNumberId,
              interactionId: reply.id,
            });
          }
        }
      }
    }
  }

  return messages;
}
