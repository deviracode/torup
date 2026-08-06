import { createClient } from "@torup/db";
import { decrypt, isEncrypted } from "@torup/shared";

export interface WhatsAppCredential {
  businessId: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
}

function decryptIfEncrypted(value: string): string {
  return isEncrypted(value) ? decrypt(value) : value;
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

/**
 * Resolve a tenant's decrypted WhatsApp credentials by business id — used to
 * verify the per-tenant webhook (GET challenge, POST signature) and to send
 * messages with that tenant's own access token.
 */
export async function getCredentialByBusinessId(
  businessId: string
): Promise<WhatsAppCredential | null> {
  const { data } = await getSupabase()
    .from("whatsapp_credentials")
    .select("business_id, phone_number_id, access_token, app_secret, verify_token, is_active")
    .eq("business_id", businessId)
    .single();

  if (!data || !data.is_active || !data.access_token || !data.app_secret || !data.verify_token) {
    return null;
  }

  return {
    businessId: data.business_id,
    phoneNumberId: data.phone_number_id,
    accessToken: decryptIfEncrypted(data.access_token),
    appSecret: decryptIfEncrypted(data.app_secret),
    verifyToken: decryptIfEncrypted(data.verify_token),
  };
}
