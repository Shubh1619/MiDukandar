-- ============================================================
-- MiDukandar - 010_expenses.sql
-- Expenses, Expense Categories & Recurring Expenses tables
-- ============================================================

-- ---------- EXPENSE CATEGORIES ----------
CREATE TABLE IF NOT EXISTS expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);
CREATE INDEX IF NOT EXISTS idx_expense_cats_store ON expense_categories(store_id);

-- ---------- EXPENSES ----------
CREATE TABLE IF NOT EXISTS expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id    UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode   TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH','UPI','CARD','BANK')),
  note           TEXT,
  attachment_url TEXT,
  created_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, expense_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(store_id, category_id);

-- ---------- RECURRING EXPENSES ----------
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id    UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  frequency      TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (frequency IN ('MONTHLY','WEEKLY')),
  next_due_date  DATE NOT NULL,
  payment_mode   TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH','UPI','CARD','BANK')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recurring_exp_store ON recurring_expenses(store_id, is_active, next_due_date);
