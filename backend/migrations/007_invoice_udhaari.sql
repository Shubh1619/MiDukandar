-- ============================================================
-- MiDukandar - 007_invoice_udhaari.sql
-- Link udhaari entries to their originating invoice and add
-- due/reminder dates so the Udhaari section can surface
-- reminders (overdue / due today / upcoming).
-- ============================================================

ALTER TABLE udhaari_entries ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE SET NULL;
ALTER TABLE udhaari_entries ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE udhaari_entries ADD COLUMN IF NOT EXISTS reminder_date DATE;

CREATE INDEX IF NOT EXISTS idx_udhaari_entries_due ON udhaari_entries(store_id, due_date);
CREATE INDEX IF NOT EXISTS idx_udhaari_entries_sale ON udhaari_entries(sale_id);