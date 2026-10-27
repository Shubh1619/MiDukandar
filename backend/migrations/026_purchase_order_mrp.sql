-- Purchase orders: keep the retail MRP quoted by the supplier alongside the
-- negotiated rate, so the printed/sent PO shows both and the shop can see the
-- margin per line. Nullable: older POs and non-retail lines have no MRP.
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(12,2);
