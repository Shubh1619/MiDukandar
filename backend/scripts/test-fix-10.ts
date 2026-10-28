/**
 * Regression test — fix-10 (B6): dashboard "today profit" and the GSTR-1
 * taxable value were computed from the wrong numbers.
 *
 * FAILS BEFORE the fix:
 *   - todayProfit used `subtotal` as the cost of goods and never subtracted the
 *     bill-level discount, so profit = paid − subtotal − tax − expenses. With a
 *     product bought at ₹60 and sold at ₹100 the dashboard reported a loss even
 *     though the sale was profitable.
 *   - getGstReport summed `(unit_price − discount) * qty` as the taxable value.
 *     `discount` is a per-line amount, not a per-unit price reduction, so it was
 *     subtracted once for every unit (₹10 of line discount on 2 units came off
 *     ₹20 instead of ₹10) — overstating the GSTR-1 taxable turnover.
 * PASSES AFTER: profit = paid − COGS(purchase_price × qty, pro-rated by
 *   paid/total) − tax − expenses. paid_amount is already net of the bill
 *   discount, so the discount is not subtracted a second time. The taxable
 *   value is unit_price × qty − line discount (line_total − tax).
 *
 * Plan-module gating: SALES_INVOICES / GST_REPORTS / PRODUCTS / EXPENSES are
 * enabled for the run and restored after.
 *
 * Run:  npx tsx scripts/test-fix-10.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";
import crypto from "node:crypto";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

/**
 * Log in as the demo owner without depending on SMTP: seed a LOGIN OTP row
 * whose hash matches the master code, then call otp/verify (which the master
 * code short-circuits in non-production).
 */
async function login(app: { inject: (o: unknown) => Promise<{ json: () => unknown; body: string; statusCode: number }> }, email: string) {
  const master = process.env.OTP_MASTER?.trim();
  if (!master) throw new Error("OTP_MASTER must be set in the environment");
  await pool.query(
    `INSERT INTO otps (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, 'LOGIN', now() + interval '10 minutes')`,
    [email.toLowerCase(), crypto.createHash("sha256").update(master).digest("hex")],
  );
  const res = await app.inject({
    method: "POST", url: "/api/auth/otp/verify",
    payload: { email, otp: master },
  });
  const body = res.json() as { accessToken?: string; user?: { storeId?: string | null } };
  if (!body.accessToken) throw new Error("login failed: " + res.body);
  return { token: body.accessToken, storeId: body.user?.storeId };
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");

  const app = buildApp({ logger: false });
  await app.listen({ port: 0, host: "127.0.0.1" });

  const auth = await login(app, "owner@midukandar.demo");
  const storeId = auth.storeId;
  const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };

  const planRes = await pool.query<{ plan_id: string }>(`SELECT plan_id FROM stores WHERE id = $1`, [storeId]);
  const planId = planRes.rows[0]?.plan_id;
  const MODULES = ["SALES_INVOICES", "GST_REPORTS", "PRODUCTS", "EXPENSES"];
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

  let productId: string | null = null;
  let saleId: string | null = null;
  let gstSaleId: string | null = null;
  let customerId: string | null = null;
  let expenseId: string | null = null;
  const tag = `fix10-${Date.now()}`;
  const PRICE = 100;
  const COST = 60;
  const GST = 18;
  const QTY = 2;
  const DISCOUNT = 20;
  const LINE_DISCOUNT = 10;

  try {
    // Product with a known cost/sell price (cost_price is what COGS must use).
    const prodRes = await app.inject({
      method: "POST", url: "/api/products", headers,
      payload: {
        name: `${tag} widget`,
        category: "Test",
        purchasePrice: COST,
        sellingPrice: PRICE,
        gstPercent: GST,
        openingStock: 100,
        minStock: 0,
        unit: "pcs",
      },
    });
    productId = (prodRes.json() as { product?: { id?: string } }).product?.id ?? null;
    check("fixtures: product created", prodRes.statusCode === 201 && !!productId, `status=${prodRes.statusCode}`);
    if (!productId) throw new Error("product not created");

    // Fully-paid CASH sale: 2 × ₹100, 18% GST, ₹20 bill discount. Used for the
    // profit assertion (a bill discount is what the old sum forgot to subtract).
    const saleRes = await app.inject({
      method: "POST", url: "/api/sales", headers,
      payload: {
        lines: [
          { productId, productName: `${tag} widget`, qty: QTY, unitPrice: PRICE, discount: 0, gstPercent: GST },
        ],
        discount: DISCOUNT,
        discountType: "FLAT",
        paymentMode: "CASH",
        paidAmount: 100000,
      },
    });
    saleId = (saleRes.json() as { sale?: { id?: string } }).sale?.id ?? null;
    check("fixtures: sale created", saleRes.statusCode === 201 && !!saleId, `status=${saleRes.statusCode} body=${saleRes.body.slice(0, 200)}`);
    if (!saleId) throw new Error("sale not created");

    // An expense so the profit also proves expenses are still deducted.
    const expRes = await app.inject({
      method: "POST", url: "/api/expenses", headers,
      payload: { title: tag, category: "Test", amount: 5, note: tag, paymentMode: "CASH" },
    });
    expenseId = (expRes.json() as { expense?: { id?: string } }).expense?.id ?? null;
    check("fixtures: expense created", expRes.statusCode === 201 && !!expenseId, `status=${expRes.statusCode} body=${expRes.body.slice(0, 160)}`);

    const sale = await pool.query<{ total: string; paid_amount: string; tax_total: string; subtotal: string; discount: string; invoice_number: string }>(
      `SELECT total, paid_amount, tax_total, subtotal, discount, invoice_number FROM sales WHERE id = $1`, [saleId],
    );
    const s = sale.rows[0];
    const paid = Number(s.paid_amount);
    const fraction = paid / Number(s.total);
    const expectedCogs = COST * QTY * fraction;
    const expectedTax = Number(s.tax_total) * fraction;
    const expectedProfit = paid - expectedCogs - expectedTax - 5;

    const statsRes = await app.inject({ method: "GET", url: "/api/reports/dashboard", headers });
    const statsBody = statsRes.json() as { stats?: { todayProfit?: number } };
    const profit = statsBody.stats?.todayProfit;
    check("fix-10 dashboard answers 200", statsRes.statusCode === 200, `status=${statsRes.statusCode} body=${statsRes.body.slice(0, 160)}`);
    check(
      "fix-10 today profit uses cost of goods, tax, discount and expenses",
      typeof profit === "number" && near(profit, expectedProfit),
      `profit=${profit} expected=${expectedProfit} (paid=${paid} cogs=${expectedCogs} tax=${expectedTax})`,
    );

    // GSTR-1 taxable value must be the discounted pre-tax value of the line:
    // taxable = unit_price*qty − line_discount, i.e. (100×2 − 10) = ₹190. The
    // old formula (unit_price − discount) * qty subtracted the discount twice
    // (once per unit) giving ₹180. The report aggregates the whole store, so a
    // dedicated sale with a line discount isolates the discrepancy.
    const gstSaleRes = await app.inject({
      method: "POST", url: "/api/sales", headers,
      payload: {
        lines: [
          { productId, productName: `${tag} widget`, qty: QTY, unitPrice: PRICE, discount: LINE_DISCOUNT, gstPercent: GST },
        ],
        paymentMode: "CASH",
        paidAmount: 100000,
      },
    });
    gstSaleId = (gstSaleRes.json() as { sale?: { id?: string } }).sale?.id ?? null;
    check("fixtures: gst sale created", gstSaleRes.statusCode === 201 && !!gstSaleId, `status=${gstSaleRes.statusCode}`);
    if (gstSaleId) {
      const gstSaleRow = await pool.query<{ invoice_number: string }>(
        `SELECT invoice_number FROM sales WHERE id = $1`, [gstSaleId],
      );
      const gstInvoice = gstSaleRow.rows[0]?.invoice_number;

      const gstRes = await app.inject({
        method: "GET", url: `/api/reports/gst?from=2000-01-01&to=${new Date().toISOString().slice(0, 10)}`, headers,
      });
      const gst = gstRes.json() as { invoices?: { invoiceNumber?: string; taxableValue?: number }[] };
      const row = (gst.invoices ?? []).find((r) => r.invoiceNumber === gstInvoice);
      const expectedTaxable = PRICE * QTY - LINE_DISCOUNT;
      check("fix-10 gst report answers 200", gstRes.statusCode === 200, `status=${gstRes.statusCode} body=${gstRes.body.slice(0, 160)}`);
      check(
        "fix-10 GSTR-1 taxable value subtracts a line discount once, not per unit",
        typeof row?.taxableValue === "number" && near(row.taxableValue, expectedTaxable),
        `taxableValue=${row?.taxableValue} expected=${expectedTaxable}`,
      );
    }
  } finally {
    if (expenseId) {
      await app.inject({ method: "DELETE", url: `/api/expenses/${expenseId}`, headers }).catch(() => undefined);
      await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]).catch(() => undefined);
    }
    if (saleId) {
      await pool.query(`DELETE FROM sale_items WHERE sale_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM payments WHERE sale_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM udhaari_entries WHERE sale_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM ledger_entries WHERE reference_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM stock_movements WHERE reference_type = 'SALE' AND reference_id = $1`, [saleId]).catch(() => undefined);
      await pool.query(`DELETE FROM sales WHERE id = $1`, [saleId]).catch(() => undefined);
    }
    if (gstSaleId) {
      await pool.query(`DELETE FROM sale_items WHERE sale_id = $1`, [gstSaleId]).catch(() => undefined);
      await pool.query(`DELETE FROM payments WHERE sale_id = $1`, [gstSaleId]).catch(() => undefined);
      await pool.query(`DELETE FROM udhaari_entries WHERE sale_id = $1`, [gstSaleId]).catch(() => undefined);
      await pool.query(`DELETE FROM ledger_entries WHERE reference_id = $1`, [gstSaleId]).catch(() => undefined);
      await pool.query(`DELETE FROM stock_movements WHERE reference_type = 'SALE' AND reference_id = $1`, [gstSaleId]).catch(() => undefined);
      await pool.query(`DELETE FROM sales WHERE id = $1`, [gstSaleId]).catch(() => undefined);
    }
    if (customerId) {
      await pool.query(`DELETE FROM customers WHERE id = $1`, [customerId]).catch(() => undefined);
    }
    if (productId) {
      await pool.query(`DELETE FROM stock_movements WHERE reference_type = 'SALE' AND reference_id IN (SELECT id FROM sales WHERE id = $1)`, [saleId ?? "00000000-0000-0000-0000-000000000000"]).catch(() => undefined);
      await pool.query(`DELETE FROM product_lots WHERE product_id = $1`, [productId]).catch(() => undefined);
      await pool.query(`DELETE FROM products WHERE id = $1`, [productId]).catch(() => undefined);
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

  console.log(failed === 0 ? "\nALL FIX-10 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-10] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
