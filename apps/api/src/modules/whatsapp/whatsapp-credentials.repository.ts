import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@torup/db";
import { encrypt, decrypt, isEncrypted } from "@torup/shared";

export type CredentialRow = {
  id: string;
  business_id: string;
  phone_number_id: string;
  access_token: string;
  app_secret: string | null;
  verify_token: string | null;
  display_phone: string | null;
  verified_at: string | null;
  is_active: boolean;
};

const COLUMNS =
  "id, business_id, phone_number_id, access_token, app_secret, verify_token, display_phone, verified_at, is_active" as const;

// Tolerates legacy plaintext rows written before encryption-at-rest shipped.
function decryptIfEncrypted(value: string | null): string | null {
  if (!value) return value;
  return isEncrypted(value) ? decrypt(value) : value;
}

function decryptRow<T extends { access_token?: string | null; app_secret?: string | null; verify_token?: string | null }>(
  row: T | null
): T | null {
  if (!row) return row;
  return {
    ...row,
    access_token: row.access_token != null ? decryptIfEncrypted(row.access_token) : row.access_token,
    app_secret: row.app_secret != null ? decryptIfEncrypted(row.app_secret) : row.app_secret,
    verify_token: row.verify_token != null ? decryptIfEncrypted(row.verify_token) : row.verify_token,
  };
}

export function createWhatsAppCredentialsRepo(client: SupabaseClient<Database>) {
  return {
    async getByBusinessId(businessId: string) {
      const res = await client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .single();
      return { ...res, data: decryptRow(res.data as any) };
    },

    async getByPhoneNumberId(phoneNumberId: string) {
      const res = await client
        .from("whatsapp_credentials")
        .select(COLUMNS)
        .eq("phone_number_id", phoneNumberId)
        .single();
      return { ...res, data: decryptRow(res.data as any) };
    },

    async upsert(
      businessId: string,
      input: {
        phoneNumberId: string;
        accessToken: string;
        appSecret?: string | null;
        verifyToken?: string | null;
        displayPhone?: string | null;
      }
    ) {
      const res = await client
        .from("whatsapp_credentials")
        .upsert(
          {
            business_id: businessId,
            phone_number_id: input.phoneNumberId,
            access_token: encrypt(input.accessToken),
            app_secret: input.appSecret ? encrypt(input.appSecret) : null,
            verify_token: input.verifyToken ? encrypt(input.verifyToken) : null,
            display_phone: input.displayPhone ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id" }
        )
        .select(COLUMNS)
        .single();
      return { ...res, data: decryptRow(res.data as any) };
    },

    async markVerified(businessId: string) {
      return client
        .from("whatsapp_credentials")
        .update({ verified_at: new Date().toISOString() })
        .eq("business_id", businessId);
    },
  };
}
