-- ============================================================
-- 023_store_expiry_warning.sql
-- Per-store "expiring soon" window for the product expiry alert.
-- Products whose expiry_date falls within `expiry_warning_days` of today
-- (or that are already past) are surfaced by GET /api/products/expiring.
-- ============================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS expiry_warning_days INTEGER NOT NULL DEFAULT 30;

-- A CHECK keeps the window sane: 0 disables the "expiring soon" grouping
-- (only already-expired products surface), while an upper bound stops a typo
-- from turning the alert into a show-everything list.
ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_expiry_warning_days_range;
ALTER TABLE stores
  ADD CONSTRAINT stores_expiry_warning_days_range
  CHECK (expiry_warning_days >= 0 AND expiry_warning_days <= 365);
