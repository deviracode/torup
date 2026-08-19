-- notifications_log is also used to record non-notification admin/system
-- events (impersonation start/stop, invoice generation) via channel="system"
-- and status="logged". These values were used in application code but never
-- added to the enums, so those inserts fail against the real DB.
ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'system';
ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'logged';
