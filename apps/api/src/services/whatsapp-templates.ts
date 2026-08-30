import type { WhatsAppCredential } from "./whatsapp";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

export interface TemplateDefinition {
  name: string;
  language: "he" | "ar";
  category: "UTILITY";
  body: string;
  example: string[];
  buttonUrl?: string; // Meta URL-button component target, {{1}}=locale, {{2}}=token
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
    buttonUrl: "https://torup.pandacode.co.il/{{1}}/a/{{2}}",
  },
  {
    name: "appointment_reminder_ar",
    language: "ar",
    category: "UTILITY",
    body: "تذكير: عندك موعد في {{1}} بتاريخ {{2}} الساعة {{3}}. بانتظارك! 😊",
    example: ["استوديو الجمال", "30.08.2026", "08:00"],
    buttonUrl: "https://torup.pandacode.co.il/{{1}}/a/{{2}}",
  },
  {
    name: "appointment_confirmed_he",
    language: "he",
    category: "UTILITY",
    body: "✅ {{1}}, התור שלך אושר!\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nנתראה! 😊",
    example: ["דנה", "תספורת", "30.08.2026", "08:00"],
    buttonUrl: "https://torup.pandacode.co.il/{{1}}/a/{{2}}",
  },
  {
    name: "appointment_confirmed_ar",
    language: "ar",
    category: "UTILITY",
    body: "✅ {{1}}، تم تأكيد موعدك!\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nنراك قريباً! 😊",
    example: ["دانا", "قص شعر", "30.08.2026", "08:00"],
    buttonUrl: "https://torup.pandacode.co.il/{{1}}/a/{{2}}",
  },
  {
    name: "appointment_rejected_he",
    language: "he",
    category: "UTILITY",
    body: "❌ {{1}}, לצערנו לא נוכל לקבל אותך בתור:\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nניתן לקבוע תור אחר בפנייה חוזרת אלינו.",
    example: ["דנה", "תספורת", "30.08.2026", "08:00"],
  },
  {
    name: "appointment_rejected_ar",
    language: "ar",
    category: "UTILITY",
    body: "❌ {{1}}، للأسف لن نتمكن من استقبالك في الموعد:\n📋 {{2}}\n📅 {{3}}\n⏰ {{4}}\nيمكنك تحديد موعد آخر بالتواصل معنا مجدداً.",
    example: ["دانا", "قص شعر", "30.08.2026", "08:00"],
  },
];

interface GraphErrorResponse {
  error?: { message: string; type: string; code: number; error_subcode?: number; fbtrace_id?: string };
}

async function graphGet<T>(path: string, accessToken: string): Promise<T | null> {
  const res = await fetch(`${WHATSAPP_API_URL}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as T & GraphErrorResponse;
  if (!res.ok || data.error) {
    console.error(
      `[WhatsApp] GET ${path.split("?")[0]} failed — HTTP ${res.status}: ` +
      `code=${data.error?.code} msg="${data.error?.message}"`
    );
    return null;
  }
  return data;
}

/**
 * Best-effort resolution of the WhatsApp Business Account id that owns a
 * given phone number, for tokens where it's discoverable via the Graph API.
 *
 * There is no "whatsapp_business_account_id" field on the phone-number node
 * (Graph API rejects it: "Tried accessing nonexisting field"). A System
 * User token's /debug_token granular_scopes only carries target_ids when the
 * grant was asset-restricted — a broadly-granted System User has none to
 * read, and me/businesses can also come back empty for a System User token
 * even when business_management is granted (confirmed against a real
 * production token). There is no known reliable way to derive the WABA id
 * from just a phone_number_id + System User token in that case — callers
 * without one should pass an explicit wabaId to provisionTemplates instead
 * (get it from WhatsApp Business Manager, same lookup already documented in
 * .claude/skills/connect-whatsapp-business/SKILL.md step 1).
 *
 * Where it *is* discoverable (e.g. a user access token with me/businesses
 * populated), this walks me/businesses -> owned_whatsapp_business_accounts
 * -> phone_numbers and matches on phoneNumberId.
 */
export async function resolveWabaId(
  phoneNumberId: string,
  accessToken: string
): Promise<string | null> {
  const businesses = await graphGet<{ data: { id: string }[] }>("me/businesses", accessToken);
  for (const business of businesses?.data ?? []) {
    const wabas = await graphGet<{ data: { id: string }[] }>(
      `${business.id}/owned_whatsapp_business_accounts`,
      accessToken
    );
    for (const waba of wabas?.data ?? []) {
      const phones = await graphGet<{ data: { id: string }[] }>(`${waba.id}/phone_numbers`, accessToken);
      if (phones?.data?.some((p) => p.id === phoneNumberId)) {
        return waba.id;
      }
    }
  }
  console.error(
    `[WhatsApp] Could not resolve WABA id for phone_number_id ${phoneNumberId} via Graph API — ` +
    `pass an explicit wabaId (from WhatsApp Business Manager) instead`
  );
  return null;
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
        ...(def.buttonUrl
          ? [
              {
                type: "BUTTONS",
                buttons: [
                  {
                    type: "URL",
                    text: "צפייה בתור",
                    url: def.buttonUrl,
                    example: ["he", "a1b2c3d4e5f6"],
                  },
                ],
              },
            ]
          : []),
      ],
    }),
  });

  const data = (await res.json()) as GraphErrorResponse;

  if (res.ok && !data.error) {
    return { name: def.name, status: "created" };
  }

  // Meta's "template already exists" error: code 100, subcode 2388023 or
  // 2388024 — confirmed both occur against production for what's otherwise
  // an identical resubmission, so match on either rather than assuming a
  // single fixed subcode.
  if (data.error?.code === 100 && (data.error?.error_subcode === 2388023 || data.error?.error_subcode === 2388024)) {
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
  credential: WhatsAppCredential,
  explicitWabaId?: string
): Promise<{ wabaId: string; results: TemplateSubmitResult[] } | { wabaId: null; results: [] }> {
  const wabaId = explicitWabaId ?? (await resolveWabaId(credential.phoneNumberId, credential.accessToken));
  if (!wabaId) return { wabaId: null, results: [] };

  const results: TemplateSubmitResult[] = [];
  for (const def of TEMPLATE_DEFINITIONS) {
    results.push(await submitTemplate(wabaId, credential.accessToken, def));
  }
  return { wabaId, results };
}
