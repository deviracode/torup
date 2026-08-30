-- 00036_appointment_customer_link_token.sql
-- Per-appointment public self-service link (confirm/reject attendance,
-- request edit/cancel). Sent via WhatsApp message templates (URL button),
-- which bypass the 24h conversation-session window that silently kills the
-- old WhatsApp quick-reply buttons for reminders sent long after the
-- customer's last inbound message. See
-- docs/superpowers/specs/2026-08-30-customer-appointment-link-design.md
--
-- hex (not base64url) so no custom encoding function is needed — Postgres's
-- built-in encode() only supports 'base64'/'hex'/'escape', and 'base64'
-- output isn't URL-safe as-is.
--
-- gen_random_bytes() lives in pgcrypto, which is not enabled by default;
-- Supabase convention is to install extensions into the "extensions" schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_link_token TEXT DEFAULT encode(extensions.gen_random_bytes(24), 'hex');

-- Backfill rows that predate the column default (DEFAULT only applies to
-- new inserts, not existing rows added by ALTER TABLE ... ADD COLUMN).
UPDATE appointments SET customer_link_token = encode(extensions.gen_random_bytes(24), 'hex') WHERE customer_link_token IS NULL;

ALTER TABLE appointments ALTER COLUMN customer_link_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_customer_link_token
  ON appointments(customer_link_token);
