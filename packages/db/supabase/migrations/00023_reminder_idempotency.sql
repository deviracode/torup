-- Idempotency table for appointment reminders.
-- Each (appointment_id, template_id) pair can only ever be claimed once.
-- processReminders inserts here BEFORE sending; a conflict means another
-- instance already claimed it, so the sender skips — eliminating the
-- read-before-write race that caused duplicate WhatsApp messages.
CREATE TABLE appointment_reminders_sent (
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  template_id    TEXT NOT NULL,
  claimed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, template_id)
);

CREATE INDEX idx_reminders_sent_appointment ON appointment_reminders_sent(appointment_id);
