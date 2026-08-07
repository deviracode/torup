-- ============================================
-- 00028: Revoke overly-broad anon customer read
--
-- The "Public can read customers" policy (00025) was added to fix the public
-- booking findOrCreate flow, but USING (true) lets ANY unauthenticated client
-- dump every customer's name + phone via the public anon key.
--
-- This migration:
--   1. Adds a scoped SECURITY DEFINER RPC for the booking flow — it only ever
--      reads/creates the single customer row for the caller's phone.
--   2. Drops the open anon SELECT policy.
-- ============================================

CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  p_phone TEXT,
  p_name TEXT DEFAULT NULL,
  p_language supported_language DEFAULT 'he'
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers;
BEGIN
  SELECT * INTO v_customer FROM public.customers WHERE phone = p_phone;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.customers (phone, name, language_preference)
      VALUES (p_phone, p_name, p_language)
      RETURNING * INTO v_customer;
    EXCEPTION WHEN unique_violation THEN
      -- Concurrent booking with the same phone — return the row that won.
      SELECT * INTO v_customer FROM public.customers WHERE phone = p_phone;
    END;
  END IF;

  RETURN v_customer;
END;
$$;

-- Only the function is exposed; the anon role cannot reach the table directly.
REVOKE ALL ON FUNCTION public.find_or_create_customer(TEXT, TEXT, supported_language) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(TEXT, TEXT, supported_language) TO anon, authenticated;

-- Close the PII leak: drop the open anon SELECT on customers.
-- (Member SELECT/UPDATE policies and the booking RPC remain in effect.)
DROP POLICY IF EXISTS "Public can read customers" ON public.customers;
