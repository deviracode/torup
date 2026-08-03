import { AppError } from "../../middleware/error-handler";
import {
  sendWhatsAppMessage,
  type WhatsAppCredential,
} from "../../services/whatsapp";
import type { createWhatsAppCredentialsRepo } from "./whatsapp-credentials.repository";

type Repo = ReturnType<typeof createWhatsAppCredentialsRepo>;
type Deps = { sendMessage: typeof sendWhatsAppMessage };

const TEST_MESSAGE = "בדיקת חיבור WhatsApp — ההגדרה תקינה ✅";

export function createWhatsAppCredentialsService(
  repo: Repo,
  deps: Deps = { sendMessage: sendWhatsAppMessage },
) {
  return {
    async resolveForBusiness(businessId: string): Promise<WhatsAppCredential | null> {
      const { data } = await repo.getByBusinessId(businessId);
      if (!data || !data.is_active || !data.access_token || !data.phone_number_id) {
        return null;
      }
      return { phoneNumberId: data.phone_number_id, accessToken: data.access_token };
    },

    async status(businessId: string) {
      const { data } = await repo.getByBusinessId(businessId);
      return {
        connected: Boolean(data && data.is_active),
        displayPhone: data?.display_phone ?? null,
        verifiedAt: data?.verified_at ?? null,
      };
    },

    async save(
      businessId: string,
      input: { phoneNumberId: string; accessToken: string; displayPhone?: string | null },
    ) {
      const { data, error } = await repo.upsert(businessId, input);
      if (error) throw new AppError(500, "Failed to save WhatsApp credentials");
      return {
        connected: true as const,
        displayPhone: data?.display_phone ?? null,
        verifiedAt: data?.verified_at ?? null,
      };
    },

    async testSend(businessId: string, to: string) {
      const cred = await this.resolveForBusiness(businessId);
      if (!cred) throw new AppError(400, "No WhatsApp number connected for this business");
      const id = await deps.sendMessage(cred, to, TEST_MESSAGE);
      if (!id) throw new AppError(400, "Test message failed — check the token and phone number id");
      await repo.markVerified(businessId);
      return { ok: true as const };
    },
  };
}
