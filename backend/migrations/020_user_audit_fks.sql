-- 020: audit references to a user must not block deleting that user.
--
-- DELETE /api/users/:id answers 500 (SQLSTATE 23503, no ON DELETE action) for
-- every user who has ever created a sale, purchase, stock movement, payment,
-- held bill, udhaari entry/payment or purchase order — i.e. every real user.
-- These columns record attribution only ("who did this"), so follow the
-- ON DELETE SET NULL convention migrations 002/004/006/010/011 already use:
-- the historical row keeps its numbers, the name goes with the deleted account.
--
-- Constraints are discovered from pg_constraint rather than by guessed names,
-- and re-added under their existing name.

DO $$
DECLARE
  tbl  text;
  col  text;
  cons record;
BEGIN
  FOR tbl, col IN
    SELECT * FROM (VALUES
      ('sales',               'created_by_id'),
      ('sales',               'reversed_by_id'),
      ('purchases',           'created_by_id'),
      ('stock_movements',     'created_by_id'),
      ('payments',            'created_by_id'),
      ('held_bills',          'created_by_id'),
      ('udhaari_entries',     'created_by_id'),
      ('udhaari_payments',    'created_by_id'),
      ('purchase_orders',     'created_by_id'),
      ('supplier_payments',   'created_by_id')
    ) AS targets(tbl, col)
  LOOP
    FOR cons IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_class frel ON frel.oid = c.confrelid
      WHERE c.contype = 'f'
        AND rel.relname = tbl
        AND frel.relname = 'users'
        AND pg_get_constraintdef(c.oid) LIKE format('FOREIGN KEY (%s)%%', col)
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', tbl, cons.conname);
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE SET NULL',
        tbl, cons.conname, col
      );
      RAISE NOTICE 'set null on delete: %.% (%)', tbl, col, cons.conname;
    END LOOP;
  END LOOP;
END $$;
