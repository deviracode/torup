-- GET /categories now uses the anon client (createAnonClient()), matching the
-- existing public-read behavior on `services`. But service_categories never got
-- an equivalent public SELECT policy, so under anon RLS the categories list came
-- back empty and the dashboard Services tab dropped every categorized service
-- (only the uncategorized one rendered).
CREATE POLICY "Public can view categories"
  ON service_categories FOR SELECT
  USING (
    business_id IN (SELECT id FROM businesses WHERE is_active = true)
  );
