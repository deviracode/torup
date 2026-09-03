-- Idempotency protection for booking creation.
--
-- Neither booking entry point had any way to detect a duplicate submission:
-- a slow network causing a client-side retry, a double-tap on "book", or a
-- WhatsApp message getting replayed could each create a second, independent
-- appointment row for what was really one booking intent.
--
-- A partial unique index (NULL is never treated as a duplicate by Postgres
-- unique indexes, so callers that don't pass a key are unaffected) lets
-- book_appointment_atomic below check for an existing row with the same key
-- and simply return it instead of creating a duplicate.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_idempotency_key
  ON appointments(business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_business_id UUID,
  p_service_id UUID,
  p_customer_id UUID,
  p_staff_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_notes TEXT,
  p_created_via booking_source,
  p_status appointment_status,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_service_max_capacity INT;
  v_buffer_minutes INT;
  v_end_with_buffer TIMESTAMPTZ;
  v_staff_ids UUID[];
  v_off_today UUID[];
  v_avail_staff_count INT;
  v_max_capacity INT;
  v_overlap_count INT;
  v_date DATE;
  v_row appointments;
BEGIN
  -- Replay of an already-completed booking: return what was already
  -- created rather than re-running (and potentially failing) the capacity
  -- check a second time for the same intent.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_row FROM appointments
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || p_service_id::text, 1));

  SELECT max_capacity, buffer_minutes INTO v_service_max_capacity, v_buffer_minutes
  FROM services WHERE id = p_service_id;

  IF v_service_max_capacity IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_end_with_buffer := p_end_time + (COALESCE(v_buffer_minutes, 0) * INTERVAL '1 minute');

  SELECT array_agg(staff_id) INTO v_staff_ids
  FROM staff_services WHERE service_id = p_service_id;

  v_date := (p_start_time AT TIME ZONE 'Asia/Jerusalem')::DATE;

  SELECT array_agg(staff_id) INTO v_off_today
  FROM breaks
  WHERE business_id = p_business_id
    AND label = 'time_off'
    AND specific_date = v_date
    AND staff_id IS NOT NULL;

  IF v_staff_ids IS NOT NULL AND array_length(v_staff_ids, 1) > 0 THEN
    SELECT count(*) INTO v_avail_staff_count
    FROM unnest(v_staff_ids) s
    WHERE s != ALL(COALESCE(v_off_today, ARRAY[]::UUID[]));
    v_max_capacity := v_avail_staff_count;
  ELSE
    v_max_capacity := v_service_max_capacity;
  END IF;

  SELECT count(*) INTO v_overlap_count
  FROM appointments a
  WHERE a.business_id = p_business_id
    AND a.start_time < v_end_with_buffer
    AND a.end_time > p_start_time
    AND a.status NOT IN ('cancelled', 'no_show', 'pending_approval')
    AND (
      v_staff_ids IS NULL OR array_length(v_staff_ids, 1) IS NULL
      OR a.service_id = p_service_id
      OR a.staff_id = ANY(v_staff_ids)
      OR a.staff_id IS NULL
    );

  IF v_overlap_count >= v_max_capacity THEN
    RAISE EXCEPTION 'SLOT_FULL' USING ERRCODE = 'P0001';
  END IF;

  -- A second, concurrent call with the SAME idempotency key that arrives
  -- while this one is still mid-flight (parallel double-tap) is caught here
  -- by the unique index rather than the pre-check above, which only guards
  -- against a retry that arrives *after* the first one already committed.
  BEGIN
    INSERT INTO appointments (
      business_id, service_id, customer_id, staff_id,
      start_time, end_time, notes, created_via, status, idempotency_key
    )
    VALUES (
      p_business_id, p_service_id, p_customer_id, p_staff_id,
      p_start_time, p_end_time, p_notes, p_created_via, p_status, p_idempotency_key
    )
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_row FROM appointments
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
  END;

  RETURN v_row;
END;
$$;
