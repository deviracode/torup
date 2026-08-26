-- Public storage bucket for business-uploaded images (logo, booking-page banner).
-- Object path convention: {business_id}/logo.<ext>  and  {business_id}/banner.<ext>
-- Public bucket => reads bypass RLS (served straight from the CDN URL);
-- writes are restricted to members of the business in the path's first segment.
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Business members can upload their own business assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_business_ids())
  );

CREATE POLICY "Business members can update their own business assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_business_ids())
  );

CREATE POLICY "Business members can delete their own business assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1]::uuid IN (SELECT get_user_business_ids())
  );
