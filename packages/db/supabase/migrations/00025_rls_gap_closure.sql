-- ============================================
-- RLS Gap Closure Migration
-- Closes gaps found in cross-table RLS audit.
-- ============================================

-- ── CUSTOMERS: allow anon SELECT (fixes public booking findOrCreate flow) ──
-- The findOrCreateCustomer pattern does SELECT-by-phone then INSERT-if-missing.
-- With the anon client, the members-only SELECT policy returned nothing,
-- so every repeat booking hit the UNIQUE(phone) constraint → 500.
CREATE POLICY "Public can read customers"
  ON customers FOR SELECT
  USING (true);

-- ── CUSTOMERS: allow members to UPDATE customers they have appointments with ──
-- The PATCH /customers/:id endpoint runs under getUserClient(req) (RLS user client)
-- but previously only super_admin could UPDATE. This closes the gap.
CREATE POLICY "Members can update customers with appointments"
  ON customers FOR UPDATE
  USING (
    id IN (
      SELECT DISTINCT customer_id FROM appointments
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

-- ── SUBSCRIPTIONS: allow members (not just owners) to SELECT their own ──
CREATE POLICY "Members can view own subscription"
  ON subscriptions FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

-- ── NOTIFICATIONS_LOG: allow members to INSERT ──
-- Internal routes use service-role, but impersonation logging in admin.ts
-- and future dashboard notification inserts need member INSERT.
CREATE POLICY "Members can insert into own business notifications"
  ON notifications_log FOR INSERT
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

-- ── SERVICE_CATEGORIES: add super_admin policy ──
-- Only member/owner policies existed; super admin via user client got nothing.
CREATE POLICY "Super admins have full access to categories"
  ON service_categories FOR ALL
  USING (is_super_admin());

-- ── STAFF_SERVICES: add super_admin policy ──
CREATE POLICY "Super admins have full access to staff_services"
  ON staff_services FOR ALL
  USING (is_super_admin());
