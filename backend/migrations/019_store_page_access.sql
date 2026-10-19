-- ============================================================
-- MiDukandar - 019_store_page_access.sql
-- Per-shop page/feature access overrides (extra restriction layer).
--
-- A platform superadmin can turn individual app pages / feature flags OFF for
-- a specific shop, on top of the plan-module and role-permission checks. Only
-- *disabled* keys are stored: an absent row means "no restriction" (allowed
-- whenever the plan and the user's role also allow it). Removing an override
-- (POSTing `true`) deletes the row.
--
-- `access_key` is either an app page key (e.g. "products") or a permission
-- flag (e.g. "can_manage_products"); the catalog lives in src/lib/pages.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS store_page_access (
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  access_key TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, access_key)
);

CREATE INDEX IF NOT EXISTS idx_store_page_access_store ON store_page_access(store_id);
