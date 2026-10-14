-- ============================================================
-- MiDukandar - 001_init.sql
-- Local PostgreSQL schema. Raw SQL, no ORM.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ---------- USERS ----------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'OWNER'
                CHECK (role IN ('OWNER','CASHIER','MANAGER','STOCK_MANAGER')),
  store_id      UUID,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_store ON users(store_id);

-- ---------- REFRESH TOKENS ----------
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- ---------- OTP ----------
CREATE TABLE otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  otp_hash   TEXT NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN','REGISTER')),
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN NOT NULL DEFAULT FALSE,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otps_email ON otps(email, purpose);

-- ---------- STORES ----------
CREATE TABLE stores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  pincode          TEXT,
  phone            TEXT,
  email            TEXT,
  gst              TEXT,
  currency         TEXT NOT NULL DEFAULT 'INR',
  language         TEXT NOT NULL DEFAULT 'hi',
  logo_url         TEXT,
  invoice_prefix   TEXT NOT NULL DEFAULT 'INV',
  invoice_sequence BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD CONSTRAINT fk_users_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

-- ---------- PRODUCTS ----------
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  barcode        TEXT,
  sku            TEXT,
  category       TEXT,
  unit           TEXT NOT NULL DEFAULT 'pc',
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  mrp            NUMERIC(12,2),
  gst_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_stock      NUMERIC(12,3) NOT NULL DEFAULT 0,
  supplier       TEXT,
  image_url      TEXT,
  is_archived    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, barcode)
);
CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_category ON products(store_id, category);
CREATE INDEX idx_products_name ON products(store_id, lower(name));

-- ---------- CUSTOMERS ----------
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  mobile          TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  pincode         TEXT,
  credit_limit    NUMERIC(12,2) NOT NULL DEFAULT 0,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_store ON customers(store_id);
CREATE INDEX idx_customers_name ON customers(store_id, lower(name));

-- ---------- SALES ----------
CREATE TABLE sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'FLAT' CHECK (discount_type IN ('FLAT','PERCENT')),
  tax_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode  TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH','UPI','CARD','CREDIT')),
  status        TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('HELD','CONFIRMED','CANCELED','REVERSED')),
  notes         TEXT,
  created_by_id UUID REFERENCES users(id),
  reversed_by_id UUID REFERENCES users(id),
  reversed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, invoice_number)
);
CREATE INDEX idx_sales_store ON sales(store_id, created_at DESC);
CREATE INDEX idx_sales_customer ON sales(customer_id);

CREATE TABLE sale_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  barcode      TEXT,
  qty          NUMERIC(12,3) NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL,
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(12,2) NOT NULL
);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

-- ---------- PURCHASES ----------
CREATE TABLE purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  purchase_number TEXT NOT NULL,
  supplier_name   TEXT NOT NULL,
  supplier_mobile TEXT,
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status  TEXT NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('UNPAID','PARTIAL','PAID')),
  notes           TEXT,
  created_by_id   UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, purchase_number)
);
CREATE INDEX idx_purchases_store ON purchases(store_id, created_at DESC);

CREATE TABLE purchase_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  barcode      TEXT,
  qty          NUMERIC(12,3) NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL,
  gst_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(12,2) NOT NULL
);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);

-- ---------- STOCK MOVEMENTS (append-only ledger; balance is DERIVED) ----------
CREATE TABLE stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty            NUMERIC(12,3) NOT NULL,          -- signed: + in / - out
  type           TEXT NOT NULL CHECK (type IN ('OPENING','SALE','PURCHASE','ADJUSTMENT','REVERSAL')),
  reference_type TEXT NOT NULL,                    -- SALE | PURCHASE | OPENING | ADJUSTMENT
  reference_id   UUID,
  balance_after  NUMERIC(12,3) NOT NULL,           -- running balance after this entry
  note           TEXT,
  created_by_id  UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at);
CREATE INDEX idx_stock_movements_store ON stock_movements(store_id, created_at DESC);

-- ---------- PAYMENTS ----------
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  sale_id        UUID REFERENCES sales(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  type           TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (type IN ('RECEIVED','PAID')),
  mode           TEXT NOT NULL DEFAULT 'CASH' CHECK (mode IN ('CASH','UPI','CARD','CREDIT')),
  reference_type TEXT,
  reference_id   TEXT,
  note           TEXT,
  created_by_id  UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_store ON payments(store_id, created_at DESC);

-- ---------- LEDGER (udhaari) ----------
CREATE TABLE ledger_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('DEBIT','CREDIT')),  -- DEBIT = owes more, CREDIT = paid
  amount         NUMERIC(12,2) NOT NULL,
  balance_after  NUMERIC(12,2) NOT NULL,
  reference_type TEXT NOT NULL,   -- SALE | PAYMENT | OPENING
  reference_id   TEXT,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_customer ON ledger_entries(customer_id, created_at DESC);
CREATE INDEX idx_ledger_store ON ledger_entries(store_id, created_at DESC);

-- ---------- HELD BILLS ----------
CREATE TABLE held_bills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_by_id UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_held_bills_store ON held_bills(store_id, updated_at DESC);

-- ---------- MIGRATIONS TRACKING ----------
CREATE TABLE IF NOT EXISTS schema_migrations (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);