-- ============================================================
-- MiDukandar - 009_suppliers.sql
-- Supplier directory, purchase orders, PO line items and
-- supplier payments. Outstanding payable is DERIVED:
--   SUM(received PO totals) - SUM(supplier_payments.amount)
-- Stock is incremented on PO receipt via stock_movements
-- (see stock.service.ts), appended atomically in the same
-- transaction as the PO status change.
-- ============================================================

-- ---------- SUPPLIERS ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  gstin         TEXT NOT NULL DEFAULT '',
  address       TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(store_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(store_id, phone);

-- ---------- PURCHASE ORDERS ----------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id    UUID NOT NULL REFERENCES suppliers(id),
  po_number      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','received','cancelled')),
  order_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date  DATE,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by_id  UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(store_id, supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(store_id, status, created_at DESC);

-- ---------- PURCHASE ORDER LINE ITEMS ----------
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  quantity    NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  rate        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- ---------- SUPPLIER PAYMENTS (nullable po_id = general payment) ----------
CREATE TABLE IF NOT EXISTS supplier_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  po_id         UUID REFERENCES purchase_orders(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode  TEXT NOT NULL DEFAULT 'CASH'
                CHECK (payment_mode IN ('CASH','UPI','CARD','CHEQUE','NEFT')),
  note          TEXT NOT NULL DEFAULT '',
  created_by_id UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sp_supplier ON supplier_payments(store_id, supplier_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_sp_po ON supplier_payments(po_id);