-- Users, roles, invites, and tenant language defaults.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('OWNER','MANAGER','CASHIER','STAFF','STOCK_MANAGER'));
END $$;

ALTER TABLE stores ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'hi';

CREATE TABLE IF NOT EXISTS roles_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('OWNER','MANAGER','CASHIER','STAFF')),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, role)
);

CREATE INDEX IF NOT EXISTS idx_roles_permissions_store ON roles_permissions(store_id);

CREATE TABLE IF NOT EXISTS user_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         TEXT,
  email        TEXT,
  phone        TEXT,
  role         TEXT NOT NULL CHECK (role IN ('MANAGER','CASHIER','STAFF')),
  invite_token TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','cancelled')),
  invited_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_invites_store ON user_invites(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(invite_token);

WITH defaults(role, permissions) AS (
  VALUES
    ('OWNER', '{
      "can_manage_invoices": true,
      "can_manage_products": true,
      "can_manage_customers": true,
      "can_manage_udhaari": true,
      "can_manage_suppliers": true,
      "can_manage_expenses": true,
      "can_view_reports": true,
      "can_manage_settings": true,
      "can_manage_users": true
    }'::jsonb),
    ('MANAGER', '{
      "can_manage_invoices": true,
      "can_manage_products": true,
      "can_manage_customers": true,
      "can_manage_udhaari": true,
      "can_manage_suppliers": true,
      "can_manage_expenses": true,
      "can_view_reports": true,
      "can_manage_settings": false,
      "can_manage_users": false
    }'::jsonb),
    ('CASHIER', '{
      "can_manage_invoices": true,
      "can_manage_products": false,
      "can_manage_customers": true,
      "can_manage_udhaari": true,
      "can_manage_suppliers": false,
      "can_manage_expenses": false,
      "can_view_reports": false,
      "can_manage_settings": false,
      "can_manage_users": false
    }'::jsonb),
    ('STAFF', '{
      "can_manage_invoices": false,
      "can_manage_products": true,
      "can_manage_customers": false,
      "can_manage_udhaari": false,
      "can_manage_suppliers": false,
      "can_manage_expenses": false,
      "can_view_reports": false,
      "can_manage_settings": false,
      "can_manage_users": false
    }'::jsonb)
)
INSERT INTO roles_permissions (store_id, role, permissions)
SELECT s.id, d.role, d.permissions
FROM stores s
CROSS JOIN defaults d
ON CONFLICT (store_id, role) DO NOTHING;
