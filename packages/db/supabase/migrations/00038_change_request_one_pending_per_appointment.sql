-- 00038_change_request_one_pending_per_appointment.sql
-- Enforce "at most one pending request per appointment" at the DB level,
-- not just in application code (change-request.service.ts's
-- findPendingByAppointment-then-create check has a check-then-act race
-- under concurrent submissions — this closes that gap).
CREATE UNIQUE INDEX IF NOT EXISTS idx_change_requests_one_pending_per_appointment
  ON appointment_change_requests(appointment_id)
  WHERE status = 'pending';
