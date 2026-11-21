-- ============================================================
-- 028_backfill_udhaari_payments.sql
-- `/api/payments/receive` used to write only a payments row and a ledger
-- CREDIT. The Udhaari screens calculate paid amounts from
-- `udhaari_payments`, so those receipts never showed up there. New receipts
-- are now allocated in the route; this backfills the historical ones.
-- ============================================================

DO $$
DECLARE
  p RECORD;
  e RECORD;
  remaining NUMERIC(12, 2);
  applied NUMERIC(12, 2);
BEGIN
  FOR p IN
    SELECT pay.id, pay.store_id, pay.customer_id, pay.amount, pay.mode,
           pay.note, pay.created_by_id, pay.created_at
    FROM payments pay
    WHERE pay.reference_type = 'CUSTOMER_PAYMENT'
      AND pay.type = 'RECEIVED'
      AND pay.amount > 0
      AND pay.customer_id IS NOT NULL
    ORDER BY pay.created_at, pay.id
  LOOP
    remaining := p.amount;

    FOR e IN
      SELECT ue.id, ue.sale_id, ue.amount,
             COALESCE(SUM(up.amount), 0) AS paid
      FROM udhaari_entries ue
      LEFT JOIN udhaari_payments up
        ON up.udhaari_entry_id = ue.id AND up.store_id = ue.store_id
      WHERE ue.store_id = p.store_id AND ue.customer_id = p.customer_id
      GROUP BY ue.id, ue.sale_id, ue.amount
      HAVING COALESCE(SUM(up.amount), 0) < ue.amount
      ORDER BY ue.entry_date, ue.created_at, ue.id
    LOOP
      EXIT WHEN remaining <= 0;
      applied := LEAST(remaining, e.amount - e.paid);

      INSERT INTO udhaari_payments
        (store_id, udhaari_entry_id, amount, mode, note, created_by_id, created_at)
      VALUES
        (p.store_id, e.id, applied,
         CASE WHEN p.mode IN ('CASH', 'UPI', 'CARD') THEN p.mode ELSE 'CASH' END,
         p.note, p.created_by_id, p.created_at);

      IF e.sale_id IS NOT NULL THEN
        UPDATE sales
           SET paid_amount = LEAST(paid_amount + applied, total),
               due_amount = GREATEST(due_amount - applied, 0),
               updated_at = now()
         WHERE id = e.sale_id AND store_id = p.store_id AND status = 'CONFIRMED';
      END IF;

      remaining := remaining - applied;
    END LOOP;
  END LOOP;
END $$;
