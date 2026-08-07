-- NULL  = customer has not responded to any reminder
-- TRUE  = customer tapped Confirm on a reminder
-- FALSE = customer tapped Cancel on a reminder
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN DEFAULT NULL;
