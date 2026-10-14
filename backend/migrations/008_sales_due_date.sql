-- Sales keep the expected payment date for credit (udhaar) invoices so the
-- invoice itself carries due_date in addition to the linked udhaari entry.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date DATE;
CREATE INDEX IF NOT EXISTS idx_sales_store_due_date ON sales(store_id, due_date);