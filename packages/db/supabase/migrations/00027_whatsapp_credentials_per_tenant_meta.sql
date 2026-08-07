-- 00027_whatsapp_credentials_per_tenant_meta.sql
-- Each tenant registers their own Meta App (not a shared platform app), so
-- the webhook app secret and verify token are per-tenant secrets too — they
-- join access_token in whatsapp_credentials rather than living in env.
-- Values are encrypted at the application layer (see @torup/shared crypto)
-- before being written to these columns.

ALTER TABLE whatsapp_credentials
  ADD COLUMN IF NOT EXISTS app_secret TEXT,
  ADD COLUMN IF NOT EXISTS verify_token TEXT;
