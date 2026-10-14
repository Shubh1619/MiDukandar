CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
  price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_yearly >= 0),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('ACTIVE','ARCHIVED','DRAFT')),
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  ads_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ads_tier TEXT NOT NULL DEFAULT 'STANDARD' CHECK (ads_tier IN ('STANDARD','MINIMAL')),
  support_tier TEXT NOT NULL DEFAULT '',
  custom_features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plans_name_lower_unique ON plans (lower(name));

CREATE TABLE IF NOT EXISTS plan_modules (
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  limit_value INTEGER CHECK (limit_value IS NULL OR limit_value >= 0),
  PRIMARY KEY (plan_id, module_key)
);

CREATE INDEX IF NOT EXISTS plan_modules_key_idx ON plan_modules (module_key, enabled);

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS stores_plan_id_idx ON stores (plan_id);

INSERT INTO plans (name, description, price_monthly, price_yearly, trial_days, display_order, status, is_popular, ads_enabled, ads_tier, support_tier, custom_features)
SELECT 'Free', 'The essentials for a new shop to start billing and stay organised.', 0, 0, 14, 1, 'ACTIVE', FALSE, TRUE, 'STANDARD', 'Standard', ARRAY['No setup fee', 'Start with a 14-day trial']
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE lower(name) = 'free');

INSERT INTO plans (name, description, price_monthly, price_yearly, trial_days, display_order, status, is_popular, ads_enabled, ads_tier, support_tier, custom_features)
SELECT 'Pro', 'More control for busy counters, credit tracking and GST-ready reporting.', 499, 4990, 14, 2, 'ACTIVE', TRUE, FALSE, 'STANDARD', 'Priority', ARRAY['Ad-free experience', 'Priority support']
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE lower(name) = 'pro');

INSERT INTO plans (name, description, price_monthly, price_yearly, trial_days, display_order, status, is_popular, ads_enabled, ads_tier, support_tier, custom_features)
SELECT 'Enterprise', 'A multi-store operating layer with hands-on onboarding and support.', 9999, 99990, 0, 3, 'ACTIVE', FALSE, FALSE, 'STANDARD', 'Dedicated Account Manager', ARRAY['Advanced analytics', 'Custom onboarding', 'Dedicated account manager']
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE lower(name) = 'enterprise');

INSERT INTO plan_modules (plan_id, module_key, enabled, limit_value)
SELECT p.id, v.module_key, v.enabled, v.limit_value
FROM plans p
CROSS JOIN (VALUES
  ('DASHBOARD', TRUE, NULL::integer),
  ('BILLING', TRUE, NULL::integer),
  ('PRODUCTS', TRUE, 25),
  ('INVENTORY', TRUE, NULL::integer),
  ('SALES_INVOICES', TRUE, NULL::integer),
  ('CUSTOMERS_UDHAARI', TRUE, NULL::integer),
  ('SUPPLIERS', FALSE, NULL::integer),
  ('PURCHASES', FALSE, NULL::integer),
  ('EXPENSES', FALSE, NULL::integer),
  ('GST_REPORTS', FALSE, NULL::integer),
  ('USERS_ROLES', FALSE, 1),
  ('MULTI_STORE', FALSE, 1),
  ('ADVANCED_ANALYTICS', FALSE, NULL::integer),
  ('BARCODE_HARDWARE', FALSE, NULL::integer),
  ('WHATSAPP_SHARING', FALSE, NULL::integer),
  ('API_ACCESS', FALSE, NULL::integer)
) AS v(module_key, enabled, limit_value)
WHERE lower(p.name) = 'free'
ON CONFLICT (plan_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value;

INSERT INTO plan_modules (plan_id, module_key, enabled, limit_value)
SELECT p.id, v.module_key, v.enabled, v.limit_value
FROM plans p
CROSS JOIN (VALUES
  ('DASHBOARD', TRUE, NULL::integer),
  ('BILLING', TRUE, NULL::integer),
  ('PRODUCTS', TRUE, 0),
  ('INVENTORY', TRUE, NULL::integer),
  ('SALES_INVOICES', TRUE, NULL::integer),
  ('CUSTOMERS_UDHAARI', TRUE, NULL::integer),
  ('SUPPLIERS', TRUE, NULL::integer),
  ('PURCHASES', TRUE, NULL::integer),
  ('EXPENSES', TRUE, NULL::integer),
  ('GST_REPORTS', TRUE, NULL::integer),
  ('USERS_ROLES', TRUE, 10),
  ('MULTI_STORE', FALSE, 1),
  ('ADVANCED_ANALYTICS', FALSE, NULL::integer),
  ('BARCODE_HARDWARE', FALSE, NULL::integer),
  ('WHATSAPP_SHARING', TRUE, NULL::integer),
  ('API_ACCESS', FALSE, NULL::integer)
) AS v(module_key, enabled, limit_value)
WHERE lower(p.name) = 'pro'
ON CONFLICT (plan_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled, limit_value = EXCLUDED.limit_value;

INSERT INTO plan_modules (plan_id, module_key, enabled, limit_value)
SELECT p.id, v.module_key, TRUE, CASE WHEN v.module_key IN ('PRODUCTS','USERS_ROLES','MULTI_STORE') THEN 0 ELSE NULL END
FROM plans p
CROSS JOIN (VALUES
  ('DASHBOARD'), ('BILLING'), ('PRODUCTS'), ('INVENTORY'), ('SALES_INVOICES'), ('CUSTOMERS_UDHAARI'),
  ('SUPPLIERS'), ('PURCHASES'), ('EXPENSES'), ('GST_REPORTS'), ('USERS_ROLES'), ('MULTI_STORE'),
  ('ADVANCED_ANALYTICS'), ('BARCODE_HARDWARE'), ('WHATSAPP_SHARING'), ('API_ACCESS')
) AS v(module_key)
WHERE lower(p.name) = 'enterprise'
ON CONFLICT (plan_id, module_key) DO UPDATE SET enabled = TRUE, limit_value = EXCLUDED.limit_value;

UPDATE stores s
SET plan_id = p.id, plan = p.name, updated_at = now()
FROM plans p
WHERE s.plan_id IS NULL AND lower(trim(s.plan)) = lower(p.name);

UPDATE stores s
SET plan_id = (SELECT id FROM plans WHERE lower(name) = 'free' LIMIT 1), plan = 'Free', updated_at = now()
WHERE s.plan_id IS NULL;
