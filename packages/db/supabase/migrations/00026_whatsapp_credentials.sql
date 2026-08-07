-- 00026_whatsapp_credentials.sql
-- Per-tenant WhatsApp Business sender identity (BYO number).
-- Accessed exclusively via the service role (server-side API), same as
-- google_calendar_tokens. RLS is enabled with no policies, so all direct
-- anon/authenticated client access is denied; the service role bypasses RLS.

CREATE TABLE IF NOT EXISTS whatsapp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  phone_number_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  display_phone TEXT,
  verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_phone_number_id
  ON whatsapp_credentials(phone_number_id);

ALTER TABLE whatsapp_credentials ENABLE ROW LEVEL SECURITY;
