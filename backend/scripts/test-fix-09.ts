/**
 * Regression test — fix-09: PUT /api/sales/:id (edit) destroyed data the caller
 * did not mention.
 *
 * FAILS BEFORE the fix: updateSale wrote `customer_id = input.customerId ?? null`,
 *   `notes = input.notes ?? null` and always rebuilt the settlement from
 *   `splitPayment(grantTotal, input.paymentMode, input.paidAmount)` while
 *   deleting every payments row. A partial edit — the request the web client
 *   sends when it only changes, say, the notes — therefore dropped the customer
 *   link, the note (when the field was absent) and, with `input.paidAmount`
 *   undefined, reset a fully-paid invoice to due / deleted its payment history.
 * PASSES AFTER: omitted fields mean "unchanged". Customer and notes survive an
 *   edit that does not mention them, a fully-paid invoice stays paid, and its
 *   payment rows are only replaced when payment mode / paid amount are supplied.
 *
 * Plan-module gating: SALES_INVOICES / CUSTOMERS_UDHAARI / PRODUCTS are enabled
 * for the run and restored after.
 *
 * Run:  npx tsx scripts/test-fix-09.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");

  const app = buildApp({ logger: false });
  await app.listen({ port: 0, host: "127.0.0.1" });

  await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: { email: "owner@midukandar.demo" } });
  const masterOtp = process.env.OTP_MASTER?.trim();
  if (!masterOtp) throw new Error("OTP_MASTER must be set in the environment");
  const verifyRes = await app.inject({
    method: "POST", url: "/api/auth/otp/verify",
    payload: { email: "owner@midukandar.demo", otp: masterOtp },
  });
  const auth = verifyRes.json() as { accessToken?: string; user?: { storeId?: string | null } };
  if (!auth.accessToken) throw new Error("login failed: " + verifyRes.body);
  const storeId = auth.user?.storeId;
  const headers = { authorization: `Bearer ${auth.accessToken}`, "content-type": "application/json" };

  const planRes = await pool.query<{ plan_id: string }>(
    `SELECT plan_id FROM stores WHERE id = $1`, [storeId],
  );
  const planId = planRes.rows[0]?.plan_id;
  const MODULES = ["SALES_INVOICES", "CUSTOMERS_UDHAARI", "PRODUCTS"];
  const prev = new Map<string, boolean>();
  if (planId) {
    const modRes = await pool.query<{ module_key: string; enabled: boolean }>(
      `SELECT module_key, enabled FROM plan_modules WHERE plan_id = $1 AND module_key = ANY($2::text[])`,
      [planId, MODULES],
    );
    for (const r of modRes.rows) prev.set(r.module_key, r.enabled);
    await pool.query(
      `UPDATE plan_modules SET enabled = TRUE WHERE plan_id = $1 AND module_key = ANY($2::text[])`,
      [planId, MODULES],
    );
  }

  const notes = `fix-09 note ${Date.now()}`;
  let saleId: string | null = null;
  let customerId: string | null = null;

  const saleState = async (id: string) => {
    const r = await pool.query<{
      customer_id: string | null; notes: string | null; paid_amount: string; due_amount: string; payment_mode: string; status: string;
    }>(`SELECT customer_id, notes, paid_amount, due_amount, payment_mode, status FROM sales WHERE id = $1`, [id]);
    const p = await pool.query<{ c: number; total: string | null }>(
      `SELECT COUNT(*)::int AS c, COALESCE(SUM(amount), 0)::text AS total FROM payments WHERE sale_id = $1`, [id],
    );
    return { ...r.rows[0], paymentCount: p.rows[0]?.c ?? 0, paymentTotal: Number(p.rows[0]?.total ?? 0) };
  };

  try {
    const custRes = await app.inject({
      method: "POST", url: "/api/customers", headers,
      payload: { name: `fix-09 customer ${Date.now()}` },
    });
    customerId = (custRes.json() as { customer?: { id?: string } }).customer?.id ?? null;
    check("fixtures: customer created", custRes.statusCode === 201 && !!customerId, `status=${custRes.statusCode}`);

    const productsRes = await app.inject({ method: "GET", url: "/api/products?limit=5", headers });
    const product = ((productsRes.json() as { products?: { id?: string; sellingPrice?: number; gstPercent?: number }[] }).products ?? [])[0];
    if (!product?.id) throw new Error("no product available");
    const price = Number(product.sellingPrice ?? 100);
    const gst = Number(product.gstPercent ?? 0);
    const pay = Math.round(price * 2 * (1 + gst / 100) * 100) / 100;

    // A fully-paid CASH sale with a note and a linked customer.
    const create = await app.inject({
      method: "POST", url: "/api/sales", headers,
      payload: {
        customerId,
        lines: [{ productId: product.id, qty: 2, unitPrice: price, gstPercent: gst }],
        paymentMode: "CASH",
        paidAmount: pay,
        notes,
      },
    });
    saleId = (create.json() as { sale?: { id?: string } }).sale?.id ?? null;
    check("fixtures: sale created", create.statusCode === 201 && !!saleId, `status=${create.statusCode} body=${create.body.slice(0, 200)}`);
    if (!saleId) throw new Error("sale not created");

    const before = await saleState(saleId);
    check(
      "fixtures: sale starts paid with a customer, note and one payment row",
      before.customer_id === customerId && before.notes === notes
        && Number(before.due_amount) === 0 && before.paymentCount === 1,
      `customer=${before.customer_id === customerId} notes=${before.notes === notes} due=${before.due_amount} payments=${before.paymentCount}`,
    );

    // --- partial edit: change ONLY the notes --------------------------------
    const edit = await app.inject({
      method: "PUT", url: `/api/sales/${saleId}`, headers,
      payload: { notes: `${notes} (edited)` },
    });
    check("fix-09 partial edit answers 200", edit.statusCode === 200, `status=${edit.statusCode} body=${edit.body.slice(0, 200)}`);

    const after = await saleState(saleId);
    check(
      "fix-09 edit kept the sale's customer",
      after.customer_id === customerId,
      `customer_id=${after.customer_id} expected=${customerId}`,
    );
    check(
      "fix-09 edit stored the new notes",
      after.notes === `${notes} (edited)`,
      `notes=${after.notes}`,
    );
    check(
      "fix-09 edit did not desettle the paid invoice",
      Number(after.due_amount) === 0 && Number(after.paid_amount) > 0,
      `paid=${after.paid_amount} due=${after.due_amount}`,
    );
    check(
      "fix-09 edit kept the payment history",
      after.paymentCount === 1 && after.paymentTotal === before.paymentTotal,
      `count=${after.paymentCount} total=${after.paymentTotal} expected=${before.paymentTotal}`,
    );

    // --- an edit that DOES supply payment fields still re-settles ------------
    const credit = await app.inject({
      method: "PUT", url: `/api/sales/${saleId}`, headers,
      payload: { paymentMode: "CREDIT", paidAmount: 0 },
    });
    const afterCredit = await saleState(saleId);
    check(
      "fix-09 an explicit payment-mode change still re-settles the invoice",
      credit.statusCode === 200 && afterCredit.payment_mode === "CREDIT" && Number(afterCredit.due_amount) > 0 && afterCredit.customer_id === customerId,
      `status=${credit.statusCode} mode=${afterCredit.payment_mode} due=${afterCredit.due_amount}`,
    );
  } finally {
    if (saleId) {
      await app.inject({ method: "DELETE", url: `/api/sales/${saleId}`, headers }).catch(() => undefined);
      await pool.query(`DELETE FROM sale_items WHERE sale_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM payments WHERE sale_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM udhaari_entries WHERE sale_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM ledger_entries WHERE reference_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM stock_movements WHERE reference_type = 'SALE' AND reference_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM sales WHERE id = $1`, [saleId]).catch(() => undefined);
    }
    if (customerId) {
      await pool.query(`DELETE FROM customers WHERE id = $1`, [customerId]).catch(() => undefined);
    }
    if (planId) {
      for (const key of MODULES) {
        await pool.query(
          `UPDATE plan_modules SET enabled = $2 WHERE plan_id = $1 AND module_key = $3`,
          [planId, prev.get(key) ?? false, key],
        );
      }
    }
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-09 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-09] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
