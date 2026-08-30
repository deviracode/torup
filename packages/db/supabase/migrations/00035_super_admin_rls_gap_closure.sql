-- ============================================
-- Super admin RLS gap closure
-- reminder_settings, google_calendar_tokens, google_calendar_events, and
-- whatsapp_credentials each only had member/owner/service-role policies —
-- a super_admin acting through the authenticated user client (not
-- service-role) got "new row violates row-level security policy" on any
-- write, since is_super_admin() was never checked. Every other table with
-- RLS enabled already has a "Super admins have full access to X" policy
-- (see 00002_rls_policies.sql and 00025_rls_gap_closure.sql); this closes
-- the same gap for the four tables that were missed.
-- ============================================

CREATE POLICY "Super admins have full access to reminder settings"
  ON reminder_settings FOR ALL
  USING (is_super_admin());

CREATE POLICY "Super admins have full access to google calendar tokens"
  ON google_calendar_tokens FOR ALL
  USING (is_super_admin());

CREATE POLICY "Super admins have full access to google calendar events"
  ON google_calendar_events FOR ALL
  USING (is_super_admin());

CREATE POLICY "Super admins have full access to whatsapp credentials"
  ON whatsapp_credentials FOR ALL
  USING (is_super_admin());
