/**
 * Regression test — fix-04: purchase-order numbering collided after a delete.
 *
 * FAILS BEFORE the fix: po_number was `COUNT(*) + 1` against a UNIQUE
 *   (store_id, po_number) index. Create three drafts (n, n+1, n+2), delete the
 *   first, and the next create computes the still-taken n+2 → SQLSTATE 23505 →
 *   500 INTERNAL_ERROR on a valid request.
 * PASSES AFTER: the number is derived from the highest numeric suffix in use
 *   plus one, serialised by `SELECT ... FOR UPDATE` on the store row, so it
 *   never reuses a live number.
 *
 * Plan-module gating: PURCHASES / SUPPLIERS / PRODUCTS are enabled for the run
 * and restored after.
 *
 * Run:  npx tsx scripts/test-fix-04.ts     (exit 0 = PASS, 1 = FAIL)
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

  const created: string[] = [];
  const purge = async (): Promise<void> => {
    for (const id of created) {
      await app.inject({ method: "DELETE", url: `/api/purchase-orders/${id}`, headers }).catch(() => undefined);
    }
  };

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
      const createdSup = await app.inject({
        method: "POST", url: "/api/suppliers", headers,
        payload: { name: `fix04 supplier ${Date.now()}` },
      });
      supplierId = (createdSup.json() as { supplier?: { id?: string } }).supplier?.id;
    }
    if (!supplierId) throw new Error("no supplier available for the test");

    const beforeList = await app.inject({ method: "GET", url: "/api/purchase-orders?limit=200", headers });
    const beforeRows = (beforeList.json() as { purchaseOrders?: { id?: string; po_number?: string }[] }).purchaseOrders ?? [];
    const liveNumbers = new Set(beforeRows.map((r) => String(r.po_number)));

    const createOne = async (label: string) => {
      const res = await app.inject({
        method: "POST", url: "/api/purchase-orders", headers,
        payload: {
          supplierId,
          status: "draft",
          lines: [{ productId: pid, quantity: 1, rate: price, taxRate: 0 }],
        },
      });
      const body = res.json() as { purchaseOrder?: { id?: string; po_number?: string }; code?: string; message?: string };
      if (res.statusCode === 201 && body.purchaseOrder?.id) created.push(body.purchaseOrder.id);
      check(
        `fix-04 create ${label}`,
        res.statusCode === 201 && !!body.purchaseOrder?.po_number,
        `status=${res.statusCode} po=${body.purchaseOrder?.po_number} code=${body.code}`,
      );
      return body.purchaseOrder;
    };

    const p1 = await createOne("A");
    const p2 = await createOne("B");
    const p3 = await createOne("C");
    check(
      "fix-04 created numbers are unique",
      !!p1?.po_number && !!p2?.po_number && !!p3?.po_number
        && new Set([p1.po_number, p2.po_number, p3.po_number]).size === 3
        && [p1, p2, p3].every((p) => !liveNumbers.has(String(p.po_number))),
      `${p1?.po_number} ${p2?.po_number} ${p3?.po_number}`,
    );

    if (p1?.id) {
      const del = await app.inject({ method: "DELETE", url: `/api/purchase-orders/${p1.id}`, headers });
      check("fix-04 deleted the first draft", del.statusCode === 200, `status=${del.statusCode}`);
      const idx = created.indexOf(p1.id);
      if (idx >= 0) created.splice(idx, 1);
    } else {
      check("fix-04 deleted the first draft", false, "no first PO id");
    }

    const p4 = await createOne("D after delete of A");
    check(
      "fix-04 number after a delete does not collide with a live PO",
      !!p4?.po_number && ![p1?.po_number, p2?.po_number, p3?.po_number].includes(p4.po_number),
      `p4=${p4?.po_number} survivors=${p2?.po_number},${p3?.po_number}`,
    );
  } finally {
    await purge();
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

  console.log(failed === 0 ? "\nALL FIX-04 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-04] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
