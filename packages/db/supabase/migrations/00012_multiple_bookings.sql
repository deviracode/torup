-- 00012_multiple_bookings.sql
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS allow_multiple_bookings BOOLEAN NOT NULL DEFAULT false;
