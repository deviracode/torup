-- Supports the per-customer "single active appointment" cap check:
--   select count(*) from appointments
--    where business_id = $1 and customer_id = $2
--      and status in ('pending_approval','pending','confirmed')
--      and start_time > now();
CREATE INDEX IF NOT EXISTS appointments_business_customer_status_start_idx
  ON appointments (business_id, customer_id, status, start_time);
