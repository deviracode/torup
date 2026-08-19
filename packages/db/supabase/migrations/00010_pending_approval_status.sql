-- Add 'pending_approval' to the appointment_status enum.
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction,
-- so this migration MUST be applied on its own (no other DDL in the same file).
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'pending_approval';
