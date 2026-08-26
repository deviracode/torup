-- 00033 only let business members (via get_user_business_ids()) write to
-- business-assets. Super admins aren't necessarily members of every
-- business, so give them the same full access they have on every other
-- table (matches the "Super admins have full access to X" pattern).
CREATE POLICY "Super admins have full access to business assets"
  ON storage.objects FOR ALL
  USING (bucket_id = 'business-assets' AND is_super_admin())
  WITH CHECK (bucket_id = 'business-assets' AND is_super_admin());
