-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Helper function: get current user's business_ids
CREATE OR REPLACE FUNCTION get_user_business_ids()
RETURNS SETOF UUID AS $$
  SELECT business_id FROM business_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user is owner of a business
CREATE OR REPLACE FUNCTION is_business_owner(p_business_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_members
    WHERE user_id = auth.uid()
    AND business_id = p_business_id
    AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- BUSINESSES
-- ============================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active businesses"
  ON businesses FOR SELECT
  USING (is_active = true);

CREATE POLICY "Members can view own business"
  ON businesses FOR SELECT
  USING (id IN (SELECT get_user_business_ids()));

CREATE POLICY "Owners can update own business"
  ON businesses FOR UPDATE
  USING (is_business_owner(id));

CREATE POLICY "Super admins have full access to businesses"
  ON businesses FOR ALL
  USING (is_super_admin());

-- ============================================
-- BUSINESS MEMBERS
-- ============================================
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own business members"
  ON business_members FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Owners can manage business members"
  ON business_members FOR ALL
  USING (is_business_owner(business_id));

CREATE POLICY "Super admins have full access to members"
  ON business_members FOR ALL
  USING (is_super_admin());

-- ============================================
-- SERVICES
-- ============================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active services"
  ON services FOR SELECT
  USING (
    is_active = true
    AND business_id IN (SELECT id FROM businesses WHERE is_active = true)
  );

CREATE POLICY "Members can view own business services"
  ON services FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Owners can manage services"
  ON services FOR ALL
  USING (is_business_owner(business_id));

CREATE POLICY "Super admins have full access to services"
  ON services FOR ALL
  USING (is_super_admin());

-- ============================================
-- WORKING HOURS
-- ============================================
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view working hours"
  ON working_hours FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE is_active = true)
  );

CREATE POLICY "Members can view own working hours"
  ON working_hours FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Owners can manage working hours"
  ON working_hours FOR ALL
  USING (is_business_owner(business_id));

CREATE POLICY "Super admins have full access to working hours"
  ON working_hours FOR ALL
  USING (is_super_admin());

-- ============================================
-- BREAKS
-- ============================================
ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view breaks"
  ON breaks FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE is_active = true)
  );

CREATE POLICY "Members can view own breaks"
  ON breaks FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Owners can manage breaks"
  ON breaks FOR ALL
  USING (is_business_owner(business_id));

CREATE POLICY "Super admins have full access to breaks"
  ON breaks FOR ALL
  USING (is_super_admin());

-- ============================================
-- CUSTOMERS (shared across businesses - identified by phone)
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view customers who have appointments with their business"
  ON customers FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT customer_id FROM appointments
      WHERE business_id IN (SELECT get_user_business_ids())
    )
  );

CREATE POLICY "Service role can manage customers"
  ON customers FOR ALL
  USING (is_super_admin());

-- Allow insert for new customers during booking
CREATE POLICY "Anyone can create customers"
  ON customers FOR INSERT
  WITH CHECK (true);

-- ============================================
-- APPOINTMENTS
-- ============================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own business appointments"
  ON appointments FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Members can manage own business appointments"
  ON appointments FOR ALL
  USING (business_id IN (SELECT get_user_business_ids()));

-- Allow customers to create appointments via public booking
CREATE POLICY "Anyone can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE is_active = true)
  );

CREATE POLICY "Super admins have full access to appointments"
  ON appointments FOR ALL
  USING (is_super_admin());

-- ============================================
-- WAITLIST
-- ============================================
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own business waitlist"
  ON waitlist FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Members can manage own business waitlist"
  ON waitlist FOR ALL
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Anyone can join waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE is_active = true)
  );

CREATE POLICY "Super admins have full access to waitlist"
  ON waitlist FOR ALL
  USING (is_super_admin());

-- ============================================
-- BOOKING RULES
-- ============================================
ALTER TABLE booking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view booking rules"
  ON booking_rules FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE is_active = true)
  );

CREATE POLICY "Owners can manage booking rules"
  ON booking_rules FOR ALL
  USING (is_business_owner(business_id));

CREATE POLICY "Super admins have full access to booking rules"
  ON booking_rules FOR ALL
  USING (is_super_admin());

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own subscription"
  ON subscriptions FOR SELECT
  USING (is_business_owner(business_id));

CREATE POLICY "Super admins have full access to subscriptions"
  ON subscriptions FOR ALL
  USING (is_super_admin());

-- ============================================
-- PLANS (public read)
-- ============================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins can manage plans"
  ON plans FOR ALL
  USING (is_super_admin());

-- ============================================
-- NOTIFICATIONS LOG
-- ============================================
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own business notifications"
  ON notifications_log FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Super admins have full access to notifications"
  ON notifications_log FOR ALL
  USING (is_super_admin());
