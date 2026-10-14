-- ============================================================
-- MiDukandar - 005_udhaari.sql
-- Split Customers & Udhaari into two concepts:
--   * customers becomes a master record (adds GSTIN column)
--   * dedicated udhaari entry + payment tables reference
--     customers via FK (no orphans).
-- Existing sales->ledger flow is untouched.
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS gst TEXT;

-- ---------- UDHAARI ENTRIES ----------
CREATE TABLE IF NOT EXISTS udhaari_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  note          TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_udhaari_entries_customer ON udhaari_entries(customer_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_udhaari_entries_store ON udhaari_entries(store_id, entry_date DESC);

-- ---------- UDHAARI PAYMENTS ----------
CREATE TABLE IF NOT EXISTS udhaari_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  udhaari_entry_id UUID NOT NULL REFERENCES udhaari_entries(id) ON DELETE CASCADE,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  mode             TEXT NOT NULL DEFAULT 'CASH' CHECK (mode IN ('CASH','UPI','CARD')),
  note             TEXT,
  created_by_id    UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_udhaari_payments_entry ON udhaari_payments(udhaari_entry_id);
CREATE INDEX IF NOT EXISTS idx_udhaari_payments_store ON udhaari_payments(store_id, created_at DESC);