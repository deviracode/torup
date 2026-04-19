-- Reminder settings: configurable reminder intervals per business
CREATE TABLE reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL CHECK (minutes_before > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, minutes_before)
);

CREATE INDEX idx_reminder_settings_business ON reminder_settings(business_id);

-- Add columns to notifications_log for WhatsApp tracking and customer responses
ALTER TABLE notifications_log
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_response TEXT CHECK (customer_response IN ('confirmed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

CREATE INDEX idx_notifications_log_whatsapp_msg ON notifications_log(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
