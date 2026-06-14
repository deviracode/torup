-- Add unique constraint on plans.name if it doesn't exist
ALTER TABLE plans ADD CONSTRAINT plans_name_unique UNIQUE (name);

-- yearly_price and max_appointments_monthly were NOT NULL; make them optional
ALTER TABLE plans ALTER COLUMN yearly_price DROP NOT NULL;
ALTER TABLE plans ALTER COLUMN max_appointments_monthly DROP NOT NULL;

-- Add feature-gate columns to plans
ALTER TABLE plans
  ADD COLUMN has_whatsapp_bot      BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN has_ai_bot            BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN max_ai_tokens_monthly INTEGER  NOT NULL DEFAULT 0;

-- Token usage tracking (per business per calendar month)
CREATE TABLE ai_token_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  month         DATE NOT NULL,
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(business_id, month)
);

ALTER TABLE ai_token_usage ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; no direct client access needed
CREATE POLICY "No direct client access to ai_token_usage"
  ON ai_token_usage FOR ALL
  USING (false);

-- Seed the four plan tiers (idempotent)
INSERT INTO plans (name, monthly_price, yearly_price, max_staff, max_appointments_monthly, has_whatsapp_bot, has_ai_bot, max_ai_tokens_monthly, is_active)
VALUES
  ('Basic',     100, NULL, 3,    NULL, false, false, 0,       true),
  ('WhatsApp',  150, NULL, 3,    NULL, true,  false, 0,       true),
  ('AI',        200, NULL, 3,    NULL, true,  true,  2400000, true),
  ('Unlimited', 300, NULL, NULL, NULL, true,  true,  2400000, true)
ON CONFLICT (name) DO NOTHING;
