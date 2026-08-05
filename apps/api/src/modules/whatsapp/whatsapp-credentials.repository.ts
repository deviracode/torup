import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";

export type CredentialRow = {
  id: string;
  business_id: string;
  phone_number_id: string;
  access_token: string;
  display_phone: string | null;
  verified_at: string | null;
  is_active: boolean;
};

const COLUMNS =
  "id, business_id, phone_number_id, access_token, display_phone, verified_at, is_active" as const;

export function createWhatsAppCredentialsRepo(client: SupabaseClient<Database>) {
  return {
    async getByBusinessId(businessId: string) {
      return client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .single();
    },

    async getByPhoneNumberId(phoneNumberId: string) {
      return client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("phone_number_id", phoneNumberId)
        .single();
    },

    async upsert(
      businessId: string,
      input: { phoneNumberId: string; accessToken: string; displayPhone?: string | null }
    ) {
      return client
        .from("whatsapp_credentials")
        .upsert(
          {
            business_id: businessId,
            phone_number_id: input.phoneNumberId,
            access_token: input.accessToken,
            display_phone: input.displayPhone ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id" }
        )
        .select(COLUMNS)
        .single();
    },

    async markVerified(businessId: string) {
      return client
        .from("whatsapp_credentials")
        .update({ verified_at: new Date().toISOString() })
        .eq("business_id", businessId);
    },
  };
}
