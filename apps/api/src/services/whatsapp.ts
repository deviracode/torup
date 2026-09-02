const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

export type WhatsAppCredential = { phoneNumberId: string; accessToken: string };

function hasCredential(c: WhatsAppCredential | null | undefined): c is WhatsAppCredential {
  return Boolean(c && c.accessToken && c.phoneNumberId);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

interface WhatsAppResponse {
  messages?: { id: string }[];
  error?: { message: string; type: string; code: number; fbtrace_id?: string };
}

export async function sendWhatsAppMessage(
  credential: WhatsAppCredential,
  to: string,
  body: string
): Promise<string | null> {
  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) To: ${to}, Message: ${body}`);
    return null;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { body },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error sending to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  const msgId = data.messages?.[0]?.id ?? null;
  if (!msgId) {
    console.error(`[WhatsApp] No message ID in response to ${to}:`, JSON.stringify(data));
  }
  return msgId;
}

export async function sendManagerApprovalRequest(
  credential: WhatsAppCredential,
  to: string,
  body: string,
  appointmentId: string
): Promise<string | null> {
  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Manager approval request to: ${to}, appointmentId: ${appointmentId}`);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: [
              { type: "reply", reply: { id: `approve_${appointmentId}`, title: "✅ אשר" } },
              { type: "reply", reply: { id: `reject_${appointmentId}`, title: "❌ דחה" } },
            ],
          },
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (manager approval) to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}

/**
 * Send the approved "manager_new_booking" WhatsApp template.
 * Unlike sendManagerApprovalRequest (a free-form interactive message), templates
 * are exempt from Meta's 24-hour customer service window — see
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 * Body params order must match the template as approved: customer name, service, date, time.
 */
export async function sendManagerNewBookingTemplate(
  credential: WhatsAppCredential,
  to: string,
  params: { customerName: string; serviceName: string; date: string; time: string },
  appointmentId: string
): Promise<string | null> {
  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Manager template to: ${to}, appointmentId: ${appointmentId}`);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: "manager_new_booking",
          // Approved under "en" in WhatsApp Manager even though the body text is Hebrew —
          // the language code must match the approved template's registered code exactly,
          // not the actual content language, or Meta rejects with error 132001.
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.customerName },
                { type: "text", text: params.serviceName },
                { type: "text", text: params.date },
                { type: "text", text: params.time },
              ],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "0",
              parameters: [{ type: "payload", payload: `approve_${appointmentId}` }],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "1",
              parameters: [{ type: "payload", payload: `reject_${appointmentId}` }],
            },
          ],
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (manager template) to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}

export async function sendInteractiveReminder(
  credential: WhatsAppCredential,
  to: string,
  body: string,
  language: string
): Promise<string | null> {
  const confirmLabel = language === "ar" ? "تأكيد ✓" : language === "en" ? "Confirm ✓" : "אישור ✓";
  const cancelLabel = language === "ar" ? "إلغاء ✗" : language === "en" ? "Cancel ✗" : "ביטול ✗";

  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Interactive reminder to: ${to}, Message: ${body}, Buttons: [${confirmLabel}, ${cancelLabel}]`);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
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

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (interactive) to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}

/**
 * Send an approved customer reminder template, bypassing Meta's 24h conversation window.
 * Uses appointment_reminder_ar for Arabic, appointment_reminder_he for all other languages.
 * Parameter order must match the approved templates: customer_name, service_name, date, time.
 * The `link` param feeds the template's URL button component (locale/token) so the message
 * links to the customer's self-service appointment page.
 */
export async function sendCustomerReminderTemplate(
  credential: WhatsAppCredential,
  to: string,
  params: { businessName: string; serviceName: string; date: string; time: string },
  language: string,
  link: { locale: string; token: string }
): Promise<string | null> {
  const templateName = language === "ar" ? "appointment_reminder_ar" : "appointment_reminder_he";
  const languageCode = language === "ar" ? "ar" : "he";

  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Customer reminder template "${templateName}" to: ${to}`, params, link);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.businessName },
                { type: "text", text: params.date },
                { type: "text", text: params.time },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [
                { type: "text", text: link.locale },
                { type: "text", text: link.token },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (customer reminder template "${templateName}") to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}

/**
 * Send an approved appointment-confirmed template to the customer, bypassing Meta's 24h window.
 * Uses appointment_confirmed_ar for Arabic, appointment_confirmed_he for all other languages.
 * Parameter order must match the approved templates: customer_name, service_name, date, time.
 *
 * Templates must be registered and approved in WhatsApp Business Manager before this works.
 * Enable via env var: WHATSAPP_APPROVAL_TEMPLATE_ENABLED=true
 * The `link` param feeds the template's URL button component (locale/token) so the message
 * links to the customer's self-service appointment page.
 */
export async function sendCustomerApprovalTemplate(
  credential: WhatsAppCredential,
  to: string,
  params: { customerName: string; serviceName: string; date: string; time: string },
  language: string,
  link: { locale: string; token: string }
): Promise<string | null> {
  const templateName = language === "ar" ? "appointment_confirmed_ar" : "appointment_confirmed_he";
  const languageCode = language === "ar" ? "ar" : "he";

  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Customer approval template "${templateName}" to: ${to}`, params, link);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.customerName },
                { type: "text", text: params.serviceName },
                { type: "text", text: params.date },
                { type: "text", text: params.time },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [
                { type: "text", text: link.locale },
                { type: "text", text: link.token },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (customer approval template "${templateName}") to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}

/**
 * Send an approved appointment-rejected template to the customer, bypassing Meta's 24h window.
 * Uses appointment_rejected_ar for Arabic, appointment_rejected_he for all other languages.
 * Parameter order must match the approved templates: customer_name, service_name, date, time.
 *
 * Unlike the freeform rejection message, this template does not include a rebook_url —
 * whoever registers it in WhatsApp Business Manager should decide whether to add a URL
 * button component for that, and whether slot-taken vs. manual rejections need separate
 * templates (this covers both with one generic message).
 *
 * Templates must be registered and approved in WhatsApp Business Manager before this works.
 * Enable via env var: WHATSAPP_REJECTION_TEMPLATE_ENABLED=true
 */
export async function sendCustomerRejectionTemplate(
  credential: WhatsAppCredential,
  to: string,
  params: { customerName: string; serviceName: string; date: string; time: string },
  language: string
): Promise<string | null> {
  const templateName = language === "ar" ? "appointment_rejected_ar" : "appointment_rejected_he";
  const languageCode = language === "ar" ? "ar" : "he";

  if (!hasCredential(credential)) {
    console.log(`[WhatsApp] (dev mode) Customer rejection template "${templateName}" to: ${to}`, params);
    return `dev_msg_${Date.now()}`;
  }

  const res = await fetch(
    `${WHATSAPP_API_URL}/${credential.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.customerName },
                { type: "text", text: params.serviceName },
                { type: "text", text: params.date },
                { type: "text", text: params.time },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = (await res.json()) as WhatsAppResponse;

  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] API error (customer rejection template "${templateName}") to ${to} — HTTP ${res.status}: ` +
      `code=${data.error?.code} type=${data.error?.type} msg="${data.error?.message}"`
    );
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}
