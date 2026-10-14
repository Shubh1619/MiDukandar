-- ============================================================
-- MiDukandar - 006_superadmin.sql
-- Platform-level SuperAdmin architecture (multi-tenant management).
--
-- NOTE: The tenant data model uses `stores` as the business/tenant unit and
-- every core table (users.store_id, sales.store_id, customers.store_id,
-- products.store_id, purchases.store_id, ...) is already keyed by it. There
-- is no `expenses` table in this schema (the web app only has an /expenses
-- shell), so nothing needs adding for it. This migration adds a central
-- superadmin layer plus tenant lifecycle (suspend/plan) columns to `stores`.
-- ============================================================

-- ---------- PLATFORM SUPERADMINS ----------
-- Completely separate from the tenant `users` table. Credentials are
-- password (bcrypt) + mandatory TOTP 2FA.
CREATE TABLE super_admins (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT NOT NULL,
  two_factor_secret  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- PLATFORM SETTINGS ----------
-- Global key/value config: feature flags, maintenance mode, default OTP /
-- email settings. `value` is JSONB so it can hold booleans / numbers / text.
CREATE TABLE platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- SUPERADMIN AUDIT LOGS ----------
-- One row per privileged action (read OR modify) performed by a superadmin
-- against a tenant, a user, or the platform itself.
CREATE TABLE superadmin_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id   UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target_tenant_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  target_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  reason          TEXT,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sa_audit_superadmin ON superadmin_audit_logs(superadmin_id, created_at DESC);
CREATE INDEX idx_sa_audit_tenant ON superadmin_audit_logs(target_tenant_id, created_at DESC);
CREATE INDEX idx_sa_audit_action ON superadmin_audit_logs(action, created_at DESC);

-- ---------- TENANT LIFECYCLE (on `stores`, the tenant table) ----------
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE','SUSPENDED')),
  ADD COLUMN IF NOT EXISTS plan            TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS plan_status     TEXT NOT NULL DEFAULT 'TRIAL'
                CHECK (plan_status IN ('TRIAL','ACTIVE','OVERDUE','CANCELED')),
  ADD COLUMN IF NOT EXISTS trial_ends_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);