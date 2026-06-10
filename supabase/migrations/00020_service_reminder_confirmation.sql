-- Add per-service toggle: should reminder messages include confirm/decline buttons?
ALTER TABLE services
  ADD COLUMN reminder_confirmation BOOLEAN NOT NULL DEFAULT true;
