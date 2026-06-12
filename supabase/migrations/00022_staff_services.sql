-- supabase/migrations/00022_staff_services.sql

CREATE TABLE staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(staff_id, service_id)
);

CREATE INDEX idx_staff_services_staff ON staff_services(staff_id);
CREATE INDEX idx_staff_services_service ON staff_services(service_id);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view staff_services"
  ON staff_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_services.staff_id
        AND bm.business_id IN (
          SELECT business_id FROM business_members WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Owners can manage staff_services"
  ON staff_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_members bm
      WHERE bm.id = staff_services.staff_id
        AND bm.business_id IN (
          SELECT business_id FROM business_members
          WHERE user_id = auth.uid() AND role = 'owner'
        )
    )
  );
