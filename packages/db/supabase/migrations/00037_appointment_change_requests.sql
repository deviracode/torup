-- 00037_appointment_change_requests.sql
-- Customer-initiated edit/cancel requests submitted via the appointment
-- self-service link (00036), reviewed by the business owner/staff in the
-- dashboard. Service-role only, same access model as whatsapp_credentials
-- (00026) — all reads/writes go through the API's service-role client, no
-- direct anon/authenticated policies.
CREATE TABLE IF NOT EXISTS appointment_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('edit', 'cancel')),
  proposed_start_time TIMESTAMPTZ,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_change_requests_business_status
  ON appointment_change_requests(business_id, status);

CREATE INDEX IF NOT EXISTS idx_change_requests_appointment
  ON appointment_change_requests(appointment_id);

ALTER TABLE appointment_change_requests ENABLE ROW LEVEL SECURITY;
