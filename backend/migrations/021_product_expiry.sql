-- ============================================================
-- 021_product_expiry.sql
-- Optional product-level expiry date.
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS expiry_date DATE;
