-- Mark past appointments as completed if they were confirmed/in_progress/pending
-- (i.e. they had approval or were scheduled — end_time has passed)
UPDATE appointments
SET status = 'completed'
WHERE status IN ('confirmed', 'in_progress', 'pending')
  AND end_time < NOW();

-- past pending_approval appointments (never accepted) → cancelled
UPDATE appointments
SET status = 'cancelled'
WHERE status = 'pending_approval'
  AND end_time < NOW();
