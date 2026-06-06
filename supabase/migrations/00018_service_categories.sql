-- New table for service categories
CREATE TABLE service_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name_he      TEXT NOT NULL,
  name_ar      TEXT,
  name_en      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_service_categories_business_id ON service_categories(business_id);

-- Add nullable category_id to services
ALTER TABLE services
  ADD COLUMN category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL;

-- RLS: same pattern as services table
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can read categories"
  ON service_categories FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can manage categories"
  ON service_categories FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM business_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
