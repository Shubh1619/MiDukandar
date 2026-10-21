/**
 * Regression test - fix-17: dashboard load time.
 *
 * The dashboard endpoint (`GET /api/reports/dashboard`) previously composed its
 * summary from nine aggregate queries fired in THREE sequential Promise.all
 * waves (today's aggregates -> balances -> recent transactions), and computed
 * the low-stock count by loading every candidate product plus its full movement
 * history into Node to total it in JavaScript.
 *
 * AFTER: all nine reads run in ONE parallel wave, the low-stock count is a
 * single SQL aggregate, and a short-TTL cache absorbs bursts. Any write that
 * changes a KPI (here: a new sale) must invalidate that cache immediately.
 *
 * FAILS BEFORE: the low-stock SQL aggregate / dashboard cache do not exist, and
 *   a just-created sale is not reflected until the TTL lapses.
 * PASSES AFTER: the endpoint returns the same low-stock count as a reference
 *   computation, and a fresh sale shows up on the very next fetch.
 *
 * Run:  npx tsx scripts/test-fix-17.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

type App = {
  inject: (o: unknown) => Promise<{ json: () => Record<string, unknown>; body: string; statusCode: number }>;
  listen: (o: unknown) => Promise<unknown>;
  close: () => Promise<void>;
};

async function login(app: App) {
  const master = process.env.OTP_MASTER?.trim();
  if (!master) throw new Error("OTP_MASTER must be set in the environment");
  const crypto = await import("node:crypto");
  await pool.query(
    `INSERT INTO otps (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, 'LOGIN', now() + interval '10 minutes')`,
    ["owner@midukandar.demo".toLowerCase(), crypto.createHash("sha256").update(master).digest("hex")],
  );
  const res = await app.inject({
    method: "POST", url: "/api/auth/otp/verify",
    payload: { email: "owner@midukandar.demo", otp: master },
  });
  const body = res.json() as { accessToken?: string; user?: { storeId?: string | null } };
  if (!body.accessToken) throw new Error("login failed: " + res.body);
  return { token: body.accessToken, storeId: body.user?.storeId as string };
}

async function main(): Promise<void> {
  await pool.query(`DELETE FROM otps`).catch(() => undefined);
  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false }) as unknown as App;
  await app.listen({ port: 0, host: "127.0.0.1" });
  let saleId: string | null = null;
  let customerId: string | null = null;

  try {
    const auth = await login(app);
    const storeId = auth.storeId;
    const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };

    // Enable the modules the sale fixture needs, then restore.
    const planRow = await pool.query<{ plan_id: string | null }>(`SELECT plan_id FROM stores WHERE id=$1`, [storeId]);
    const planId = planRow.rows[0]?.plan_id;
    const MODULES = ["SALES_INVOICES", "CUSTOMERS_UDHAARI", "PRODUCTS"];
    const prev = new Map<string, boolean>();
    if (planId) {
      const cur = await pool.query<{ module_key: string; enabled: boolean }>(
        `SELECT module_key, enabled FROM plan_modules WHERE plan_id=$1 AND module_key = ANY($2::text[])`,
        [planId, MODULES],
      );
      for (const r of cur.rows) prev.set(r.module_key, r.enabled);
      await pool.query(
        `UPDATE plan_modules SET enabled=TRUE WHERE plan_id=$1 AND module_key = ANY($2::text[])`,
        [planId, MODULES],
      );
    }

    // ---- 1. Shape + low-stock correctness ----------------------------------
    const res1 = await app.inject({ method: "GET", url: "/api/reports/dashboard", headers });
    const body1 = res1.json() as { stats?: Record<string, number> };
    const stats1 = body1.stats ?? {};
    check(
      "fix-17 dashboard returns 200 with a stats object",
      res1.statusCode === 200 && typeof stats1 === "object",
      `status=${res1.statusCode}`,
    );
    check(
      "fix-17 stats expose the expected KPI keys",
      ["todaySales", "todayPurchases", "todayProfit", "receivables", "payables", "lowStockCount"].every(
        (k) => typeof stats1[k] === "number",
      ),
      `keys=${Object.keys(stats1).join(",")}`,
    );

    // Reference low-stock count computed independently (old JS semantics).
    const ref = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM products p
       LEFT JOIN (
         SELECT product_id, SUM(qty) AS qty FROM stock_movements WHERE store_id=$1 GROUP BY product_id
       ) sm ON sm.product_id = p.id
       WHERE p.store_id=$1 AND p.is_archived=FALSE AND p.min_stock > 0
         AND COALESCE(sm.qty,0) < p.min_stock`,
      [storeId],
    );
    const expectedLow = Number(ref.rows[0]?.c ?? 0);
    check(
      "fix-17 lowStockCount matches an independent SQL reference",
      Number(stats1.lowStockCount) === expectedLow,
      `endpoint=${stats1.lowStockCount} reference=${expectedLow}`,
    );

    // ---- 2. Cache invalidation on a KPI-changing write ---------------------
    const beforeSales = Number(stats1.todaySales);

    const custRes = await app.inject({ method: "POST", url: "/api/customers", headers, payload: { name: `fix17 ${Date.now()}` } });
    customerId = (custRes.json() as { customer?: { id?: string } }).customer?.id ?? null;

    const prodRes = await app.inject({ method: "GET", url: "/api/products?limit=1", headers });
    const product = ((prodRes.json() as { products?: { id?: string; sellingPrice?: number; gstPercent?: number }[] }).products ?? [])[0];
    if (!product?.id) throw new Error("no product fixture available");
    const price = Number(product.sellingPrice ?? 100);
    const gst = Number(product.gstPercent ?? 0);
    const paid = Math.round(price * (1 + gst / 100) * 100) / 100;

    const create = await app.inject({
      method: "POST", url: "/api/sales", headers,
      payload: {
        customerId,
        lines: [{ productId: product.id, qty: 1, unitPrice: price, gstPercent: gst }],
        paymentMode: "CASH",
        paidAmount: paid,
      },
    });
    check("fix-17 fixture sale created (201)", create.statusCode === 201, `status=${create.statusCode} body=${create.body.slice(0, 160)}`);
    saleId = (create.json() as { sale?: { id?: string } }).sale?.id ?? null;

    // Immediately re-fetch: without invalidation this would still serve the
    // cached pre-sale summary for up to DASHBOARD_TTL_MS.
    const res2 = await app.inject({ method: "GET", url: "/api/reports/dashboard", headers });
    const afterSales = Number((res2.json() as { stats?: Record<string, number> }).stats?.todaySales ?? 0);
    check(
      "fix-17 a new sale is reflected on the very next dashboard fetch (cache invalidated)",
      afterSales > beforeSales,
      `before=${beforeSales} after=${afterSales} paid=${paid}`,
    );

    // ---- restore plan modules ---------------------------------------------
    if (planId && prev.size > 0) {
      for (const [key, enabled] of prev) {
        await pool.query(`UPDATE plan_modules SET enabled=$1 WHERE plan_id=$2 AND module_key=$3`, [enabled, planId, key]);
      }
    }
  } finally {
    // Remove fixtures so the created sale does not pollute other dashboard
    // tests that assert on today's totals.
    try {
      if (saleId) {
        await pool.query(`DELETE FROM ledger_entries WHERE reference_id=$1`, [saleId]).catch(() => undefined);
        await pool.query(`DELETE FROM payments WHERE sale_id=$1`, [saleId]).catch(() => undefined);
        await pool.query(`DELETE FROM stock_movements WHERE reference_id=$1`, [saleId]).catch(() => undefined);
        await pool.query(`DELETE FROM sales WHERE id=$1`, [saleId]).catch(() => undefined);
      }
      if (customerId) {
        await pool.query(`DELETE FROM ledger_entries WHERE customer_id=$1`, [customerId]).catch(() => undefined);
        await pool.query(`DELETE FROM customers WHERE id=$1`, [customerId]).catch(() => undefined);
      }
    } catch { /* noop */ }
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-17 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-17] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
