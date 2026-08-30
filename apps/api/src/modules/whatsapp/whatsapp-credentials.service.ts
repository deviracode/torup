import { AppError } from "../../middleware/error-handler";
import { sendWhatsAppMessage, type WhatsAppCredential } from "../../services/whatsapp";
import { provisionTemplates } from "../../services/whatsapp-templates";
import type { createWhatsAppCredentialsRepo } from "./whatsapp-credentials.repository";

type Repo = ReturnType<typeof createWhatsAppCredentialsRepo>;
type Deps = { sendMessage: typeof sendWhatsAppMessage; provisionTemplates: typeof provisionTemplates };
const DEFAULT_DEPS: Deps = { sendMessage: sendWhatsAppMessage, provisionTemplates };

const TEST_MESSAGE = "בדיקת חיבור WhatsApp — ההגדרה תקינה ✅";

export function createWhatsAppCredentialsService(
  repo: Repo,
  deps: Partial<Deps> = {}
) {
  const resolvedDeps: Deps = { ...DEFAULT_DEPS, ...deps };
  async function resolveForBusiness(businessId: string): Promise<WhatsAppCredential | null> {
    const { data } = await repo.getByBusinessId(businessId);
    if (!data || !data.is_active || !data.access_token || !data.phone_number_id) {
      return null;
    }
    return { phoneNumberId: data.phone_number_id, accessToken: data.access_token };
  }

  async function resolveMeta(
    businessId: string
  ): Promise<{ appSecret: string; verifyToken: string } | null> {
    const { data } = await repo.getByBusinessId(businessId);
    if (!data || !data.is_active || !data.app_secret || !data.verify_token) {
      return null;
    }
    return { appSecret: data.app_secret, verifyToken: data.verify_token };
  }

  async function status(businessId: string) {
    const { data } = await repo.getByBusinessId(businessId);
    return {
      connected: Boolean(data && data.is_active),
      displayPhone: data?.display_phone ?? null,
      verifiedAt: data?.verified_at ?? null,
    };
  }

  async function save(
    businessId: string,
    input: {
      phoneNumberId: string;
      accessToken: string;
      appSecret?: string | null;
      verifyToken?: string | null;
      displayPhone?: string | null;
    }
  ) {
    const { data, error } = await repo.upsert(businessId, input);
    if (error) throw new AppError(500, "Failed to save WhatsApp credentials");

    // Fire-and-forget: submit the app's required message templates to this
    // business's WABA so manual-booking confirmations/reminders/rejections
    // (which need to reach customers outside the 24h session window) work
    // without anyone having to do this by hand per business. Template
    // approval is async on Meta's side regardless, so this never blocks the
    // connect flow — failures are logged, not thrown.
    resolvedDeps.provisionTemplates({ phoneNumberId: input.phoneNumberId, accessToken: input.accessToken })
      .then(({ wabaId, results }) => {
        if (!wabaId) {
          console.error(`[WhatsApp] Could not resolve WABA id for business ${businessId} — skipping template provisioning`);
          return;
        }
        console.log(`[WhatsApp] Template provisioning for business ${businessId} (waba ${wabaId}):`,
          results.map((r) => `${r.name}=${r.status}`).join(", "));
      })
      .catch((err) => console.error(`[WhatsApp] Template provisioning threw for business ${businessId}:`, err));

    return {
      connected: true as const,
      displayPhone: data?.display_phone ?? null,
      verifiedAt: data?.verified_at ?? null,
    };
  }

  async function testSend(businessId: string, to: string) {
    const cred = await resolveForBusiness(businessId);
    if (!cred) throw new AppError(400, "No WhatsApp number connected for this business");
    const id = await resolvedDeps.sendMessage(cred, to, TEST_MESSAGE);
    if (!id) throw new AppError(400, "Test message failed — check the token and phone number id");
    await repo.markVerified(businessId);
    return { ok: true as const };
  }

  return { resolveForBusiness, resolveMeta, status, save, testSend };
}
