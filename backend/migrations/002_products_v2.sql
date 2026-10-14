-- ============================================================
-- 002_products_v2.sql
-- Products v2: description, archived metadata, duplicate-prevention indexes
-- ============================================================

-- ---------- new columns ----------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by_id UUID
      REFERENCES users(id) ON DELETE SET NULL;

-- ---------- UNIQUE constraints (partial, where applicable) ----------
-- SKU uniqueness within a store (multiple NULLs allowed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_store_sku
  ON products (store_id, sku)
  WHERE sku IS NOT NULL;

-- Normalized product name uniqueness within a store,
-- but ONLY for products that have neither SKU nor barcode.
-- Handles case, leading/trailing whitespace, and multiple spaces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_store_name
  ON products (store_id, lower(trim(regexp_replace(name, '\s+', ' ', 'g'))))
  WHERE sku IS NULL AND barcode IS NULL;
