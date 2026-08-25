-- Track why an appointment was cancelled so the dashboard can distinguish
-- an auto-cancelled double-booking conflict from a normal cancellation
-- instead of silently hiding it from the calendar.
ALTER TABLE appointments ADD COLUMN cancellation_reason TEXT;
