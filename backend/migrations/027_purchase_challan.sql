-- Purchase challan fields used by the purchase-order entry screen:
-- party bill number and date, cash/credit type, and per-line pack, batch,
-- expiry, loose tablets, free quantity, and discount percent.
-- Strip quantity stays in purchase_order_items.quantity.
-- line_total remains the payable line (after discount, including GST).

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS party_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS party_date DATE,
  ADD COLUMN IF NOT EXISTS challan_type TEXT NOT NULL DEFAULT 'CASH';

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_challan_type_check;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_challan_type_check
  CHECK (challan_type IN ('CASH', 'CREDIT'));

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS pack TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS batch TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS tab_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
