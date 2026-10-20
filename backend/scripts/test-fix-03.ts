/**
 * Regression test — fix-03: purchase-order product validation rejected valid
 * multi-line orders.
 *
 * FAILS BEFORE the fix: both POST /api/purchase-orders and
 *   PATCH /api/purchase-orders/:id validated with
 *   `products.length !== body.lines.length` where `products` comes from
 *   `WHERE id = ANY($2::uuid[])` — `ANY` collapses duplicates, so a legitimate
 *   order listing the SAME product on two lines was rejected with 400
 *   PRODUCT_NOT_FOUND even though both products exist in the store.
 * PASSES AFTER: membership is checked per line, so duplicate product lines are
 *   accepted while a genuinely foreign product id still answers 400.
 *
 * Plan-module gating: PURCHASES / SUPPLIERS / PRODUCTS are enabled for the run
 * and restored after (the demo Free plan does not include them).
 *
 * Run:  npx tsx scripts/test-fix-03.ts     (exit 0 = PASS, 1 = FAIL)
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
  const MODULES = ["PURCHASES", "SUPPLIERS", "PRODUCTS"];
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

  let poId: string | null = null;
  try {
    const productsRes = await app.inject({ method: "GET", url: "/api/products?limit=5", headers });
    const products = (productsRes.json() as { products?: { id?: string; sellingPrice?: number }[] }).products ?? [];
    check("fixtures: store has a product", products.length > 0, `status=${productsRes.statusCode}`);
    const pid = String(products[0]?.id);
    const price = Number(products[0]?.sellingPrice ?? 100);

    const supRes = await app.inject({ method: "GET", url: "/api/suppliers?limit=1", headers });
    const suppliers = (supRes.json() as { suppliers?: { id?: string }[] }).suppliers ?? [];
    let supplierId = suppliers[0]?.id;
    if (!supplierId) {
      const created = await app.inject({
        method: "POST", url: "/api/suppliers", headers,
        payload: { name: `fix03 supplier ${Date.now()}` },
      });
      supplierId = (created.json() as { supplier?: { id?: string } }).supplier?.id;
      check("fixtures: supplier created", !!supplierId, `status=${created.statusCode} ${created.body.slice(0, 200)}`);
    }
    if (!supplierId) throw new Error("no supplier available for the test");

    const lines = [
      { productId: pid, quantity: 1, rate: price, taxRate: 0 },
      { productId: pid, quantity: 3, rate: price, taxRate: 0 },
    ];

    const create = await app.inject({
      method: "POST", url: "/api/purchase-orders", headers,
      payload: { supplierId, status: "draft", lines },
    });
    const createBody = create.json() as { purchaseOrder?: { id?: string; total_amount?: string } };
    poId = createBody.purchaseOrder?.id ?? null;
    check(
      "fix-03 POST accepts the same product on two lines (201)",
      create.statusCode === 201 && !!poId,
      `status=${create.statusCode} body=${create.body.slice(0, 240)}`,
    );
    if (poId) {
      const detail = await app.inject({ method: "GET", url: `/api/purchase-orders/${poId}`, headers });
      const items = (detail.json() as { purchaseOrder?: { items?: unknown[] } }).purchaseOrder?.items ?? [];
      check(
        "fix-03 created PO has both line items",
        items.length === 2,
        `items=${items.length}`,
      );
    }

    if (poId) {
      const update = await app.inject({
        method: "PATCH", url: `/api/purchase-orders/${poId}`, headers,
        payload: { lines },
      });
      check(
        "fix-03 PATCH accepts the same product on two lines (200)",
        update.statusCode === 200,
        `status=${update.statusCode} body=${update.body.slice(0, 240)}`,
      );
    }

    const foreign = await app.inject({
      method: "POST", url: "/api/purchase-orders", headers,
      payload: {
        supplierId,
        status: "draft",
        lines: [{ productId: "00000000-0000-4000-8000-000000000000", quantity: 1, rate: price, taxRate: 0 }],
      },
    });
    const foreignBody = foreign.json() as { code?: string; error?: string };
    check(
      "fix-03 a foreign product id is still rejected (400 PRODUCT_NOT_FOUND)",
      foreign.statusCode === 400 && foreignBody.code === "PRODUCT_NOT_FOUND",
      `status=${foreign.statusCode} code=${foreignBody.code}`,
    );
  } finally {
    if (poId) {
      await app.inject({ method: "DELETE", url: `/api/purchase-orders/${poId}`, headers })
        .catch(() => undefined);
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

  console.log(failed === 0 ? "\nALL FIX-03 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-03] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
