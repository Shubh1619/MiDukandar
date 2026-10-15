/**
 * Regression test — P2-01 + P2-02: supplier invoice endpoint
 *
 * P2-01 (Flutter contract): the mobile app called `POST /api/suppliers/invoice`
 *   (no supplier id) which does not exist → 404. The real route is
 *   `POST /api/suppliers/:id/invoice`. This test exercises that real route.
 * P2-02 (Backend): the route passed `withTx` (a function) to createPurchase as
 *   the DbClient, so getNextNumber's `db.qOne(...)` threw
 *   `TypeError: db.qOne is not a function` → 500 on every call.
 *
 * FAILS BEFORE the fix: `POST /api/suppliers/<id>/invoice` → 500 (status >= 500,
 *   no purchase row / purchase_items / stock movement written).
 * PASSES AFTER the fix: → 201 with a purchase row, its purchase_items and the
 *   matching stock movement ledger entry, all written in one transaction.
 *
 * Uses tenant B (owner@mazedukan.demo) and creates + removes its own supplier,
 * product, purchase and store-sequence changes so the DB returns to baseline.
 *
 * Run:  npx tsx scripts/test-p2-01-02.ts     (exit 0 = PASS, 1 = FAIL)
 */
import "dotenv/config";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";
import type { FastifyInstance } from "fastify";

const EMAIL = "owner@mazedukan.demo"; // tenant B (Pro)
const STORE_ID = "e9f8f5c3-ba70-4e63-9d36-15da3ac41885";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  const app: FastifyInstance = buildApp({ logger: false });
  await app.ready();

  await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);

  const otpRes = await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: { email: EMAIL } });
  const devOtp = (otpRes.json() as { devOtp?: string }).devOtp;
  if (!devOtp) throw new Error(`no devOtp: ${otpRes.statusCode} ${otpRes.body}`);
  const verifyRes = await app.inject({ method: "POST", url: "/api/auth/otp/verify", payload: { email: EMAIL, otp: devOtp } });
  const token = (verifyRes.json() as { accessToken?: string }).accessToken;
  if (!token) throw new Error(`verify failed: ${verifyRes.statusCode} ${verifyRes.body}`);
  const H = { authorization: `Bearer ${token}` };

  const { rows: seqRows } = await pool.query<{ invoice_sequence: number }>(
    `SELECT invoice_sequence FROM stores WHERE id = $1`,
    [STORE_ID],
  );
  const seqBefore = seqRows[0]?.invoice_sequence;

  let supplierId = "";
  let productId = "";
  let purchaseId = "";
  let purchaseNumber = "";

  try {
    // ── fixtures: a supplier and a catalog product (needed for a stock move) ──
    const supRes = await app.inject({
      method: "POST",
      url: "/api/suppliers",
      headers: H,
      payload: { name: `P2-01-02 Supplier ${Date.now()}`, phone: "9000000000" },
    });
    supplierId = (supRes.json() as { supplier?: { id?: string } }).supplier?.id ?? "";
    check("supplier fixture created", supRes.statusCode === 201 && !!supplierId, `status=${supRes.statusCode}`);

    const prodRes = await app.inject({
      method: "POST",
      url: "/api/products",
      headers: H,
      payload: { name: `P2-01-02 Product ${Date.now()}`, purchasePrice: 40, sellingPrice: 60, openingStock: 0 },
    });
    productId = (prodRes.json() as { product?: { id?: string } }).product?.id ?? "";
    check("product fixture created", prodRes.statusCode === 201 && !!productId, `status=${prodRes.statusCode}`);

    // ── the endpoint under test ───────────────────────────────────────────────
    const invRes = await app.inject({
      method: "POST",
      url: `/api/suppliers/${supplierId}/invoice`,
      headers: H,
      payload: {
        supplierMobile: "9000000000",
        lines: [{ productId, qty: 2, unitPrice: 50, gstPercent: 0 }],
        discount: 0,
        paidAmount: 100,
        notes: "P2-01-02 integration",
      },
    });
    const body = invRes.json() as { purchase?: { id?: string; purchase_number?: string } };
    purchaseId = body.purchase?.id ?? "";
    purchaseNumber = body.purchase?.purchase_number ?? "";

    check("invoice endpoint does not 5xx", invRes.statusCode < 500, `status=${invRes.statusCode} body=${invRes.body}`);
    check("invoice created (201)", invRes.statusCode === 201, `status=${invRes.statusCode} body=${invRes.body}`);
    check("response carries purchase id", !!purchaseId, `purchase.id=${purchaseId}`);

    if (purchaseId) {
      const purchaseRow = await pool.query<{ total: number; paid_amount: number; due_amount: number; payment_status: string }>(
        `SELECT total, paid_amount, due_amount, payment_status FROM purchases WHERE id = $1 AND store_id = $2`,
        [purchaseId, STORE_ID],
      );
      check("purchases row committed in store", purchaseRow.rows.length === 1, `rows=${purchaseRow.rows.length}`);

      const itemsRow = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM purchase_items WHERE purchase_id = $1`,
        [purchaseId],
      );
      check("purchase_items row committed", itemsRow.rows[0]?.count === 1, `count=${itemsRow.rows[0]?.count}`);

      const moveRow = await pool.query<{ qty: number; type: string; reference_type: string }>(
        `SELECT qty, type, reference_type FROM stock_movements WHERE reference_id = $1`,
        [purchaseId],
      );
      check("stock movement ledger entry committed", moveRow.rows.length === 1, `rows=${moveRow.rows.length}`);
      check(
        "stock movement is +2 PURCHASE",
        moveRow.rows[0]?.qty === 2 && moveRow.rows[0]?.type === "PURCHASE",
        `qty=${moveRow.rows[0]?.qty} type=${moveRow.rows[0]?.type}`,
      );
    }

    // ── the old, broken Flutter path must remain a 404 (documents P2-01) ──────
    const wrongPath = await app.inject({
      method: "POST",
      url: "/api/suppliers/invoice",
      headers: H,
      payload: { lines: [{ qty: 1, unitPrice: 10 }] },
    });
    check("old /api/suppliers/invoice path is 404", wrongPath.statusCode === 404, `status=${wrongPath.statusCode}`);
  } finally {
    // ── cleanup: remove everything this run created ───────────────────────────
    try {
      if (purchaseId) {
        await pool.query(`DELETE FROM stock_movements WHERE reference_id = $1`, [purchaseId]);
        await pool.query(`DELETE FROM purchase_items WHERE purchase_id = $1`, [purchaseId]);
        await pool.query(`DELETE FROM purchases WHERE id = $1`, [purchaseId]);
      }
      if (productId) {
        await pool.query(`DELETE FROM stock_movements WHERE product_id = $1`, [productId]);
        await pool.query(`DELETE FROM products WHERE id = $1`, [productId]);
      }
      if (supplierId) await pool.query(`DELETE FROM suppliers WHERE id = $1`, [supplierId]);
      if (seqBefore !== undefined) await pool.query(`UPDATE stores SET invoice_sequence = $1 WHERE id = $2`, [seqBefore, STORE_ID]);
      await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);
      console.log(`[cleanup] removed fixtures (purchase=${purchaseNumber || purchaseId || "n/a"}) and restored invoice_sequence`);
    } catch (e) {
      console.log(`[cleanup] WARN ${(e as Error).message}`);
    }
  }

  await app.close();
  await pool.end();
  console.log(failed > 0 ? `\nP2-01/02 TEST FAILED: ${failed} check(s)` : "\nP2-01/02 TEST PASSED: all checks green");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
