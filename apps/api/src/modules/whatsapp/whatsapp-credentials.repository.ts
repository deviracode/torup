import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
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

type SingleResult = { data: CredentialRow | null; error: PostgrestError | null };

const COLUMNS =
  "id, business_id, phone_number_id, access_token, display_phone, verified_at, is_active" as const;

export function createWhatsAppCredentialsRepo(client: SupabaseClient<Database>) {
  return {
    async getByBusinessId(businessId: string): Promise<SingleResult> {
      return client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .single() as any;
    },

    async getByPhoneNumberId(phoneNumberId: string): Promise<SingleResult> {
      return client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("phone_number_id", phoneNumberId)
        .single() as any;
    },

    async upsert(
      businessId: string,
      input: { phoneNumberId: string; accessToken: string; displayPhone?: string | null },
    ): Promise<SingleResult> {
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
          { onConflict: "business_id" },
        )
        .select(COLUMNS)
        .single() as any;
    },

    async markVerified(businessId: string): Promise<{ error: PostgrestError | null }> {
      return client
        .from("whatsapp_credentials")
        .update({ verified_at: new Date().toISOString() })
        .eq("business_id", businessId) as any;
    },
  };
}
