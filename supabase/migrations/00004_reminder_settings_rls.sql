-- RLS for reminder_settings
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view reminder settings"
  ON reminder_settings FOR SELECT
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "Business owners can insert reminder settings"
  ON reminder_settings FOR INSERT
  WITH CHECK (is_business_owner(business_id));

CREATE POLICY "Business owners can update reminder settings"
  ON reminder_settings FOR UPDATE
  USING (is_business_owner(business_id));

CREATE POLICY "Business owners can delete reminder settings"
  ON reminder_settings FOR DELETE
  USING (is_business_owner(business_id));

CREATE POLICY "Service role full access to reminder settings"
  ON reminder_settings FOR ALL
  USING (auth.role() = 'service_role');
