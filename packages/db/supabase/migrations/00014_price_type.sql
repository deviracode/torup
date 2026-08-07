-- 00014_price_type.sql
-- Add price_type to services to support "discuss with manager" pricing model.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'fixed'
  CHECK (price_type IN ('fixed', 'discuss'));
