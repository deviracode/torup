import type { WhatsAppCredential } from "./whatsapp";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

export interface TemplateDefinition {
  name: string;
  language: "he" | "ar";
  category: "UTILITY";
  body: string;
  example: string[];
}

/**
 * The full set of message templates the app needs to reach customers outside
 * WhatsApp's 24h conversation window (manual bookings with no prior inbound
 * message, or any reminder sent long after the customer's last message).
 * Parameter order/count must match what services/whatsapp.ts actually sends
 * in each template's `components[0].parameters` — not just what a docstring
 * claims.
 */
export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    name: "appointment_reminder_he",
    language: "he",
    category: "UTILITY",
    body: "תזכורת: יש לך תור ב-{{1}} בתאריך {{2}} בשעה {{3}}. מחכים לך! 😊",
    example: ["סטודיו יופי", "30.08.2026", "08:00"],
  },
  {
    name: "appointment_reminder_ar",
    language: "ar",
    category: "UTILITY",
    body: "تذكير: عندك موعد في {{1}} بتاريخ {{2}} الساعة {{3}}. بانتظارك! 😊",
    example: ["استوديو الجمال", "30.08.2026", "08:00"],
  },
  {
    name: "appointment_confirmed_he",
    language: "he",
    category: "UTILITY",
    body: "✅ {{1}}, התור שלך אושר!\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nנתראה! 😊",
    example: ["דנה", "תספורת", "30.08.2026", "08:00"],
  },
  {
    name: "appointment_confirmed_ar",
    language: "ar",
    category: "UTILITY",
    body: "✅ {{1}}، تم تأكيد موعدك!\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nنراك قريباً! 😊",
    example: ["دانا", "قص شعر", "30.08.2026", "08:00"],
  },
  {
    name: "appointment_rejected_he",
    language: "he",
    category: "UTILITY",
    body: "{{1}}, לצערנו לא נוכל לקבל אותך בתור:\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nניתן לקבוע תור אחר בפנייה חוזרת אלינו.",
    example: ["דנה", "תספורת", "30.08.2026", "08:00"],
  },
  {
    name: "appointment_rejected_ar",
    language: "ar",
    category: "UTILITY",
    body: "{{1}}، للأسف لن نتمكن من استقبالك في الموعد:\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nيمكنك تحديد موعد آخر بالتواصل معنا مجدداً.",
    example: ["دانا", "قص شعر", "30.08.2026", "08:00"],
  },
];

interface GraphErrorResponse {
  error?: { message: string; type: string; code: number; error_subcode?: number; fbtrace_id?: string };
}

/**
 * Resolve the WhatsApp Business Account id that owns a phone number. Needed
 * because credentials are stored per phone-number-id, but template
 * create/list is a WABA-level operation.
 */
export async function resolveWabaId(
  phoneNumberId: string,
  accessToken: string
): Promise<string | null> {
  const res = await fetch(
    `${WHATSAPP_API_URL}/${phoneNumberId}?fields=whatsapp_business_account_id`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = (await res.json()) as GraphErrorResponse & { whatsapp_business_account_id?: string };
  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] Failed to resolve WABA id for phone_number_id ${phoneNumberId} — HTTP ${res.status}: ` +
      `code=${data.error?.code} msg="${data.error?.message}"`
    );
    return null;
  }
  return data.whatsapp_business_account_id ?? null;
}

export type TemplateSubmitResult =
  | { name: string; status: "created" }
  | { name: string; status: "already_exists" }
  | { name: string; status: "failed"; error: string };

/**
 * Submit one template for Meta review. Treats "already exists" as success —
 * this is meant to be safely re-runnable (onboarding hook + bulk backfill)
 * without erroring on templates a business already has.
 */
async function submitTemplate(
  wabaId: string,
  accessToken: string,
  def: TemplateDefinition
): Promise<TemplateSubmitResult> {
  const res = await fetch(`${WHATSAPP_API_URL}/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: def.name,
      language: def.language,
      category: def.category,
      components: [
        {
          type: "BODY",
          text: def.body,
          example: { body_text: [def.example] },
        },
      ],
    }),
  });

  const data = (await res.json()) as GraphErrorResponse;

  if (res.ok && !data.error) {
    return { name: def.name, status: "created" };
  }

  // Meta's "template already exists" error: code 100, subcode 2388023.
  if (data.error?.code === 100 && data.error?.error_subcode === 2388023) {
    return { name: def.name, status: "already_exists" };
  }

  const error = `HTTP ${res.status}: code=${data.error?.code} subcode=${data.error?.error_subcode} msg="${data.error?.message}"`;
  console.error(`[WhatsApp] Template submit failed for "${def.name}" (waba ${wabaId}) — ${error}`);
  return { name: def.name, status: "failed", error };
}

/**
 * Submit all app-required templates for a business's WABA. Best-effort: one
 * template failing (e.g. a name collision with different content, or a rate
 * limit) doesn't stop the rest. Callers should treat this as fire-and-forget
 * during onboarding, and inspect the per-template results for a bulk backfill.
 */
export async function provisionTemplates(
  credential: WhatsAppCredential
): Promise<{ wabaId: string; results: TemplateSubmitResult[] } | { wabaId: null; results: [] }> {
  const wabaId = await resolveWabaId(credential.phoneNumberId, credential.accessToken);
  if (!wabaId) return { wabaId: null, results: [] };

  const results: TemplateSubmitResult[] = [];
  for (const def of TEMPLATE_DEFINITIONS) {
    results.push(await submitTemplate(wabaId, credential.accessToken, def));
  }
  return { wabaId, results };
}
