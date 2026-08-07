-- Acquire a transaction-level advisory lock for the booking cap check.
-- Prevents a race where two simultaneous inserts from the same customer
-- both pass the count check before either writes.
CREATE OR REPLACE FUNCTION acquire_booking_lock(biz_id text, cust_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(biz_id || ':' || cust_id, 0));
END;
$$;
