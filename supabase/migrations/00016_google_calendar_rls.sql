-- Enable RLS on Google Calendar tables.
-- These tables are accessed exclusively via the service role (server-side API).
-- The service role bypasses RLS by default, so no explicit policies are needed.
-- All direct client (anon/authenticated) access is denied.

ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;
