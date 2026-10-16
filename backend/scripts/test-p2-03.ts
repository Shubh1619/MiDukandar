/**
 * Regression test — P2-03: Flutter sale-update payload omits required `lines` (400).
 *
 * The mobile "edit invoice" dialog only edits customer / paid amount / payment
 * mode and PUTs `{customer, paymentMode, paidAmount, notes}` — no `lines`.
 * `PUT /api/sales/:id` used to parse the full `saleSchema` (which requires
 * `lines.min(1)`), so the request was rejected with `400 VALIDATION_ERROR` and
 * editing an invoice from the app could never succeed.
 *
 * FAILS BEFORE the fix: PUT with the app's payload → 400, no edit applied.
 * PASSES AFTER the fix: → 200 and the sale's stored lines, bill discount and
 *   credit due date are preserved (only the supplied fields change).
 *
 * Uses tenant B (owner@mazedukan.demo) and creates + removes its own customer,
 * credit sale and store-sequence change so the DB returns to baseline.
 *
 * Run:  npx tsx scripts/test-p2-03.ts     (exit 0 = PASS, 1 = FAIL)
 */
import "./load-env.js";
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

  const custName = `P2-03 Cust ${Date.now()}`;
  const itemName = `P2-03 Item ${Date.now()}`;
  let saleId = "";
  let invoiceNumber = "";
  let totalBefore = 0;

  try {
    // ── fixture: an unpaid CREDIT sale (the app only offers Edit on those) ─────
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers: H,
      payload: {
        customer: { name: custName, mobile: "9000000000" },
        lines: [{ productName: itemName, qty: 2, unitPrice: 100, discount: 5, gstPercent: 0 }],
        paymentMode: "CREDIT",
        discount: 10,
        discountType: "FLAT",
        paidAmount: 0,
        udhaar: { dueDate: "2026-12-01" },
        notes: "P2-03 create",
      },
    });
    const created = createRes.json() as { sale?: Record<string, unknown> };
    saleId = String(created.sale?.id ?? "");
    invoiceNumber = String(created.sale?.invoice_number ?? "");
    totalBefore = Number(created.sale?.total ?? 0);
    check("sale fixture created (201)", createRes.statusCode === 201 && !!saleId, `status=${createRes.statusCode}`);

    // ── the exact payload the Flutter edit dialog sends (no `lines`) ──────────
    const appPayload = {
      customer: { name: custName, mobile: "9000000000", address: "", city: "", state: "", pincode: "", gst: "" },
      paymentMode: "CREDIT",
      paidAmount: 0,
      notes: "Edited from mobile app",
    };
    const putRes = await app.inject({ method: "PUT", url: `/api/sales/${saleId}`, headers: H, payload: appPayload });
    check("PUT with app payload is not rejected (not 400)", putRes.statusCode !== 400, `status=${putRes.statusCode} body=${putRes.body}`);
    check("PUT with app payload succeeds (200)", putRes.statusCode === 200, `status=${putRes.statusCode} body=${putRes.body}`);

    const saleRow = await pool.query<{ discount: string; discount_type: string; total: string; due_amount: string; payment_mode: string; status: string; due_ymd: string | null }>(
      `SELECT discount, discount_type, total, due_amount, payment_mode, status, to_char(due_date, 'YYYY-MM-DD') AS due_ymd
         FROM sales WHERE id = $1 AND store_id = $2`,
      [saleId, STORE_ID],
    );
    const itemsRow = await pool.query<{ product_name: string; qty: string; unit_price: string; discount: string; gst_percent: string }>(
      `SELECT product_name, qty, unit_price, discount, gst_percent FROM sale_items WHERE sale_id = $1`,
      [saleId],
    );

    check("sale_items preserved (1 line)", itemsRow.rows.length === 1, `rows=${itemsRow.rows.length}`);
    check(
      "stored line fields unchanged",
      itemsRow.rows[0]?.product_name === itemName &&
        Number(itemsRow.rows[0]?.qty) === 2 &&
        Number(itemsRow.rows[0]?.unit_price) === 100 &&
        Number(itemsRow.rows[0]?.discount) === 5 &&
        Number(itemsRow.rows[0]?.gst_percent) === 0,
      JSON.stringify(itemsRow.rows[0]),
    );
    check("bill discount preserved", Number(saleRow.rows[0]?.discount) === 10, `discount=${saleRow.rows[0]?.discount}`);
    check("discount type preserved", saleRow.rows[0]?.discount_type === "FLAT", `type=${saleRow.rows[0]?.discount_type}`);
    check("credit due date preserved", saleRow.rows[0]?.due_ymd === "2026-12-01", `due_date=${saleRow.rows[0]?.due_ymd}`);
    check("sale total preserved", Number(saleRow.rows[0]?.total) === totalBefore, `total=${saleRow.rows[0]?.total} expected=${totalBefore}`);
    check("sale still CONFIRMED", saleRow.rows[0]?.status === "CONFIRMED", `status=${saleRow.rows[0]?.status}`);
  } finally {
    // ── cleanup: remove everything this run created ───────────────────────────
    try {
      if (saleId) {
        await pool.query(`DELETE FROM udhaari_entries WHERE sale_id = $1`, [saleId]);
        await pool.query(`DELETE FROM ledger_entries WHERE reference_type = 'SALE' AND reference_id = $1`, [saleId]);
        await pool.query(`DELETE FROM payments WHERE sale_id = $1`, [saleId]);
        await pool.query(`DELETE FROM sale_items WHERE sale_id = $1`, [saleId]);
        await pool.query(`DELETE FROM sales WHERE id = $1`, [saleId]);
      }
      await pool.query(`DELETE FROM customers WHERE store_id = $1 AND name = $2`, [STORE_ID, custName]);
      if (seqBefore !== undefined) await pool.query(`UPDATE stores SET invoice_sequence = $1 WHERE id = $2`, [seqBefore, STORE_ID]);
      await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);
      console.log(`[cleanup] removed fixtures (sale=${invoiceNumber || saleId || "n/a"}) and restored invoice_sequence`);
    } catch (e) {
      console.log(`[cleanup] WARN ${(e as Error).message}`);
    }
  }

  await app.close();
  await pool.end();
  console.log(failed > 0 ? `\nP2-03 TEST FAILED: ${failed} check(s)` : "\nP2-03 TEST PASSED: all checks green");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
