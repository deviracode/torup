-- Atomic capacity-check-and-insert for appointment booking.
--
-- Before this, both booking entry points (the API's appointment.service.ts
-- and the WhatsApp bot's services/whatsapp-agent) read the current overlap
-- count, decided in application code whether capacity was available, and
-- only THEN inserted — two separate round-trips with nothing holding the
-- slot between them. Two concurrent bookings for the last open spot could
-- both pass the read before either write landed, exceeding max_capacity.
-- The WhatsApp path additionally had no capacity check at all: it only
-- guarded against the SAME customer double-booking themselves.
--
-- This function does the whole check-and-insert as a single statement
-- inside a single transaction, serialized per (business, service) via a
-- transaction-scoped advisory lock — the same pg_advisory_xact_lock
-- mechanism already used by acquire_booking_lock (00013), just correctly
-- scoped this time: because the lock, the capacity read, and the insert
-- all happen inside ONE function call (one PostgREST request = one
-- transaction), the lock is actually held across the whole critical
-- section instead of being released before the insert runs.
--
-- Capacity math mirrors appointment.repository.ts's findOverlapping /
-- appointment.service.ts's checkSlotCapacity exactly: staffed services
-- use "how many assigned staff aren't off today" as capacity and only
-- conflict with appointments touching those staff (or unstaffed ones, or
-- the same service); unstaffed services fall back to services.max_capacity
-- and conflict with anything overlapping in the business at all.
CREATE OR REPLACE FUNCTION book_appointment_atomic(
  p_business_id UUID,
  p_service_id UUID,
  p_customer_id UUID,
  p_staff_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_notes TEXT,
  p_created_via booking_source,
  p_status appointment_status
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

  INSERT INTO appointments (
    business_id, service_id, customer_id, staff_id,
    start_time, end_time, notes, created_via, status
  )
  VALUES (
    p_business_id, p_service_id, p_customer_id, p_staff_id,
    p_start_time, p_end_time, p_notes, p_created_via, p_status
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
