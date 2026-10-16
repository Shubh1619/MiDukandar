/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Second-pass audit reproduction harness (READ-ONLY against source; writes
 * throwaway rows to the local dev DB and best-effort cleans them up).
 *
 * Uses Fastify's in-process `app.inject` so concurrent requests share the same
 * event loop / DB pool as a real server.
 *
 * Run:  npx tsx scripts/audit-pass2.ts
 */
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

const results: { area: string; name: string; status: string; detail?: string }[] = [];
function rec(area: string, name: string, status: string, detail?: string) {
  results.push({ area, name, status, detail });
  console.log(`[${status}] ${area} :: ${name}${detail ? ` :: ${detail}` : ""}`);
}

const json = { "content-type": "application/json" };

async function login(app: any, email: string): Promise<string> {
  const r1 = await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: JSON.stringify({ email }), headers: json });
  const otp = (r1.json() as any).devOtp;
  if (!otp) throw new Error(`no devOtp for ${email} (status ${r1.statusCode}) ${r1.body}`);
  const r2 = await app.inject({ method: "POST", url: "/api/auth/otp/verify", payload: JSON.stringify({ email, otp }), headers: json });
  const tok = (r2.json() as any).accessToken;
  if (!tok) throw new Error(`no accessToken for ${email} (status ${r2.statusCode}) ${r2.body}`);
  return tok;
}

const saleIds: string[] = [];
const productIds: string[] = [];
const customerIds: string[] = [];

async function main() {
  const app = buildApp({ logger: false });
  const H = (t: string) => ({ authorization: `Bearer ${t}`, ...json });
  const inj = (opts: any) => app.inject(opts);

  const tokA = await login(app, "owner@midukandar.demo"); // store f457..., Free plan
  const tokB = await login(app, "owner@mazedukan.demo"); // store e9f8..., Pro plan
  rec("setup", "login both tenants", "PASS", "A=Free, B=Pro");

  // ───────────────────────── Area 1: IDOR ─────────────────────────
  try {
    const cust = await inj({ method: "POST", url: "/api/customers", headers: H(tokB), payload: JSON.stringify({ name: "AUDIT2 Victim", mobile: "9000000001" }) });
    const cB = (cust.json() as any).customer?.id;
    customerIds.push(cB);

    const prod = await inj({ method: "POST", url: "/api/products", headers: H(tokB), payload: JSON.stringify({ name: "AUDIT2 Prod", sellingPrice: 100, purchasePrice: 60, gstPercent: 0, openingStock: 5 }) });
    const pB = (prod.json() as any).product?.id;
    productIds.push(pB);

    const sale = await inj({ method: "POST", url: "/api/sales", headers: H(tokB), payload: JSON.stringify({ lines: [{ productId: pB, qty: 1, unitPrice: 100, gstPercent: 0 }], paymentMode: "CASH", paidAmount: 100 }) });
    const sB = (sale.json() as any).sale?.id;
    saleIds.push(sB);

    const held = await inj({ method: "POST", url: "/api/sales/hold", headers: H(tokB), payload: JSON.stringify({ payload: { x: 1 } }) });
    const hB = (held.json() as any).heldBill?.id;

    if (!cB || !pB || !sB) throw new Error(`setup failed cB=${cB} pB=${pB} sB=${sB}`);

    const checks: [string, any, string[]][] = [
      ["GET /customers/:id", await inj({ method: "GET", url: `/api/customers/${cB}`, headers: H(tokA) }), ["404"]],
      ["PUT /customers/:id", await inj({ method: "PUT", url: `/api/customers/${cB}`, headers: H(tokA), payload: JSON.stringify({ name: "pwned" }) }), ["404"]],
      ["DELETE /customers/:id", await inj({ method: "DELETE", url: `/api/customers/${cB}`, headers: H(tokA) }), ["404"]],
      ["GET /products/:id", await inj({ method: "GET", url: `/api/products/${pB}`, headers: H(tokA) }), ["404"]],
      ["PUT /products/:id", await inj({ method: "PUT", url: `/api/products/${pB}`, headers: H(tokA), payload: JSON.stringify({ name: "pwned" }) }), ["404"]],
      ["POST /products/:id/adjust", await inj({ method: "POST", url: `/api/products/${pB}/adjust`, headers: H(tokA), payload: JSON.stringify({ qty: 10 }) }), ["404"]],
      ["DELETE /products/:id", await inj({ method: "DELETE", url: `/api/products/${pB}`, headers: H(tokA) }), ["404"]],
      ["GET /sales/:id", await inj({ method: "GET", url: `/api/sales/${sB}`, headers: H(tokA) }), ["404"]],
      ["GET /sales/:id/invoice", await inj({ method: "GET", url: `/api/sales/${sB}/invoice`, headers: H(tokA) }), ["404"]],
      ["GET /sales/:id/invoice/pdf", await inj({ method: "GET", url: `/api/sales/${sB}/invoice/pdf`, headers: H(tokA) }), ["404"]],
      ["POST /sales/:id/pay", await inj({ method: "POST", url: `/api/sales/${sB}/pay`, headers: H(tokA), payload: JSON.stringify({ amount: 1 }) }), ["404"]],
      ["POST /sales/:id/reverse", await inj({ method: "POST", url: `/api/sales/${sB}/reverse`, headers: H(tokA), payload: JSON.stringify({ reason: "idor" }) }), ["404"]],
      ["GET /sales/held/:id", await inj({ method: "GET", url: `/api/sales/held/${hB}`, headers: H(tokA) }), ["404"]],
    ];
    for (const [name, res, want] of checks) {
      const got = String(res.statusCode);
      rec("Area1 IDOR", name, want.includes(got) ? "PASS" : "FAIL", `got ${got} want ${want.join("/")}`);
    }

    // Cross-tenant DELETE /sales/held/:id: the handler always answers 200 (no
    // existence check) but the WHERE store_id filter must leave the victim row
    // intact. Assert survival, and separately flag the misleading 200.
    const delHeld = await inj({ method: "DELETE", url: `/api/sales/held/${hB}`, headers: H(tokA) });
    const stillThere = await inj({ method: "GET", url: `/api/sales/held/${hB}`, headers: H(tokB) });
    rec("Area1 IDOR", "cross-tenant DELETE /sales/held/:id (row survives?)", stillThere.statusCode === 200 ? "PASS" : "FAIL", `A_delete=${delHeld.statusCode} (misleading no-op) victim_row_survives=${stillThere.statusCode === 200}`);

    // Cross-tenant product injection into createSale (B's product used by A).
    const injectRes = await inj({ method: "POST", url: "/api/sales", headers: H(tokA), payload: JSON.stringify({ lines: [{ productId: pB, qty: 1, unitPrice: 1 }], paymentMode: "CASH", paidAmount: 1 }) });
    const injectBody = injectRes.json() as any;
    rec("Area1 IDOR", "createSale with foreign productId", injectRes.statusCode === 400 && injectBody.code === "INVALID_PRODUCT" ? "PASS" : "FAIL", `got ${injectRes.statusCode} code=${injectBody.code}`);

    // Tenant access token against superadmin API.
    const sa = await inj({ method: "GET", url: "/api/superadmin/tenants", headers: H(tokA) });
    rec("Area1 IDOR", "tenant token → /api/superadmin/tenants", ["401", "403"].includes(String(sa.statusCode)) ? "PASS" : "FAIL", `got ${sa.statusCode}`);
  } catch (e) {
    rec("Area1 IDOR", "suite", "ERROR", (e as Error).message);
  }

  // ───────────────────────── Area 2: races ─────────────────────────
  try {
    const list = await inj({ method: "GET", url: "/api/products?limit=5", headers: H(tokA) });
    const pA = ((list.json() as any).products ?? [])[0];
    if (!pA) throw new Error("no product for A");

    // (a) getNextNumber atomicity: 20 concurrent sales → unique invoice numbers
    const N = 20;
    const rs = await Promise.all(
      Array.from({ length: N }, () =>
        inj({ method: "POST", url: "/api/sales", headers: H(tokA), payload: JSON.stringify({ lines: [{ productId: pA.id, qty: 1, unitPrice: Number(pA.sellingPrice) || 1, gstPercent: Number(pA.gstPercent) || 0 }], paymentMode: "CASH", paidAmount: Number(pA.sellingPrice) || 1, notes: "AUDIT-PASS2-RACE" }) }),
      ),
    );
    const ok = rs.filter((r: any) => r.statusCode === 201);
    const nums = ok.map((r: any) => (r.json() as any).sale?.invoiceNumber).filter(Boolean);
    ok.forEach((r: any) => { const id = (r.json() as any).sale?.id; if (id) saleIds.push(id); });
    const unique = new Set(nums);
    rec("Area2 race", "invoice-number uniqueness (20 concurrent)", ok.length === N && unique.size === N ? "PASS" : "FAIL", `ok=${ok.length} unique=${unique.size} statuses=${[...new Set(rs.map((r: any) => r.statusCode))].join(",")}`);

    // (b) last-unit oversell: product with stock 1, two concurrent sales
    const pLU = await inj({ method: "POST", url: "/api/products", headers: H(tokA), payload: JSON.stringify({ name: `AUDIT2 LU ${Date.now()}`, sellingPrice: 10, purchasePrice: 5, gstPercent: 0, openingStock: 1 }) });
    const luId = (pLU.json() as any).product?.id;
    productIds.push(luId);
    const lu = await Promise.all([
      inj({ method: "POST", url: "/api/sales", headers: H(tokA), payload: JSON.stringify({ lines: [{ productId: luId, qty: 1, unitPrice: 10 }], paymentMode: "CASH", paidAmount: 10, notes: "AUDIT-PASS2-LU" }) }),
      inj({ method: "POST", url: "/api/sales", headers: H(tokA), payload: JSON.stringify({ lines: [{ productId: luId, qty: 1, unitPrice: 10 }], paymentMode: "CASH", paidAmount: 10, notes: "AUDIT-PASS2-LU" }) }),
    ]);
    const luOk = lu.filter((r: any) => r.statusCode === 201);
    lu.filter((r: any) => r.statusCode === 201).forEach((r: any) => { const id = (r.json() as any).sale?.id; if (id) saleIds.push(id); });
    const luDetail = await inj({ method: "GET", url: `/api/products/${luId}`, headers: H(tokA) });
    const luStock = (luDetail.json() as any).product?.stockOnHand ?? (luDetail.json() as any).product?.currentStock ?? "?";
    rec("Area2 race", "last-unit oversell (2 concurrent, stock=1)", luOk.length === 1 ? "PASS" : "FAIL", `successes=${luOk.length} (want 1); finalStock=${luStock}; statuses=${lu.map((r: any) => r.statusCode).join(",")}`);

    // (c) overpayment: credit sale + 3 concurrent full payments
    const custC = await inj({ method: "POST", url: "/api/customers", headers: H(tokA), payload: JSON.stringify({ name: "AUDIT2 PayCustomer", mobile: "9000000002" }) });
    const cA = (custC.json() as any).customer?.id;
    customerIds.push(cA);
    const T = 100;
    const cs = await inj({ method: "POST", url: "/api/sales", headers: H(tokA), payload: JSON.stringify({ customerId: cA, lines: [{ productId: pA.id, qty: 1, unitPrice: T }], paymentMode: "CREDIT", notes: "AUDIT-PASS2-PAY" }) });
    const csId = (cs.json() as any).sale?.id;
    if (csId) saleIds.push(csId);
    const pays = await Promise.all(
      Array.from({ length: 3 }, () => inj({ method: "POST", url: `/api/sales/${csId}/pay`, headers: H(tokA), payload: JSON.stringify({ amount: T }) })),
    );
    const payOk = pays.filter((r: any) => r.statusCode === 200 || r.statusCode === 201);
    const after = await inj({ method: "GET", url: `/api/sales/${csId}`, headers: H(tokA) });
    const aSale = (after.json() as any).sale;
    const paid = Number(aSale?.paidAmount ?? 0);
    const due = Number(aSale?.dueAmount ?? 0);
    rec("Area2 race", "overpayment prevention (3 concurrent full pays)", payOk.length === 1 && paid <= T + 0.001 && due >= -0.001 ? "PASS" : "FAIL", `successes=${payOk.length} (want 1) paid=${paid} due=${due}; statuses=${pays.map((r: any) => r.statusCode).join(",")}`);
  } catch (e) {
    rec("Area2 race", "suite", "ERROR", (e as Error).message);
  }

  // ───────────────────────── Area 4: plan gating ─────────────────────────
  try {
    const expA = await inj({ method: "GET", url: "/api/expenses", headers: H(tokA) });
    rec("Area4 gating", "Free → GET /api/expenses", expA.statusCode === 403 ? "PASS" : "FAIL", `got ${expA.statusCode}`);
    const expB = await inj({ method: "GET", url: "/api/expenses", headers: H(tokB) });
    rec("Area4 gating", "Pro → GET /api/expenses", expB.statusCode === 200 ? "PASS" : "FAIL", `got ${expB.statusCode}`);
    const supA = await inj({ method: "GET", url: "/api/suppliers", headers: H(tokA) });
    rec("Area4 gating", "Free → GET /api/suppliers", supA.statusCode === 403 ? "PASS" : "FAIL", `got ${supA.statusCode}`);
    const dashA = await inj({ method: "GET", url: "/api/reports/dashboard", headers: H(tokA) });
    rec("Area4 gating", "Free → GET /api/reports/dashboard", dashA.statusCode === 200 ? "PASS" : "FAIL", `got ${dashA.statusCode}`);

    // bypass attempts: trailing slash + case variation + encoded path
    const variants = ["/api/expenses/", "/api/Expenses", "/api/EXPENSES", "/api/expenses%2f", "/api/./expenses"];
    for (const v of variants) {
      const r = await inj({ method: "GET", url: v, headers: H(tokA) });
      const bypass = r.statusCode === 200;
      rec("Area4 gating", `bypass attempt ${v}`, bypass ? "FAIL" : "PASS", `got ${r.statusCode}`);
    }
  } catch (e) {
    rec("Area4 gating", "suite", "ERROR", (e as Error).message);
  }

  // ───────────────────────── Area 5: OTP / recovery ─────────────────────────
  try {
    const unknown = await inj({ method: "POST", url: "/api/auth/otp/request", headers: json, payload: JSON.stringify({ email: "does-not-exist@example.com" }) });
    rec("Area5 auth", "OTP request enumeration (unknown email)", unknown.statusCode === 404 && (unknown.json() as any).code === "ACCOUNT_NOT_FOUND" ? "ENUMERABLE" : "PASS", `got ${unknown.statusCode} code=${(unknown.json() as any).code}`);

    const known = await inj({ method: "POST", url: "/api/auth/otp/request", headers: json, payload: JSON.stringify({ email: "owner@mazedukan.demo" }) });
    rec("Area5 auth", "OTP request known email", known.statusCode === 200 ? "PASS" : "FAIL", `got ${known.statusCode}`);

    const regConflict = await inj({ method: "POST", url: "/api/auth/register", headers: json, payload: JSON.stringify({ email: "owner@midukandar.demo", ownerName: "Test Owner", name: "Test Store", type: "kirana" }) });
    rec("Area5 auth", "register existing email enumeration", regConflict.statusCode === 409 ? "ENUMERABLE" : "PASS", `got ${regConflict.statusCode}`);

    // master OTP active in dev
    await inj({ method: "POST", url: "/api/auth/otp/request", headers: json, payload: JSON.stringify({ email: "owner@mazedukan.demo" }) });
    const masterVerify = await inj({ method: "POST", url: "/api/auth/otp/verify", headers: json, payload: JSON.stringify({ email: "owner@mazedukan.demo", otp: "000000" }) });
    rec("Area5 auth", "OTP_MASTER bypass active (dev)", masterVerify.statusCode === 200 ? "ACTIVE" : "PASS", `got ${masterVerify.statusCode}`);

    // per-email OTP request limit (5 / 10min) — must reuse the SAME email
    const rlEmail = `rl-${Date.now()}@example.com`;
    let rl = 0;
    for (let i = 0; i < 6; i++) {
      const r = await inj({ method: "POST", url: "/api/auth/otp/request", headers: json, payload: JSON.stringify({ email: rlEmail, purpose: "REGISTER" }) });
      if ((r.json() as any).code === "OTP_RATE_LIMITED") rl = i + 1;
    }
    rec("Area5 auth", "per-email OTP request limit (same email)", rl === 6 ? "PASS" : "FAIL", `first limited at request #${rl} (want 6)`);

    // recovery reset-token replay
    const init = await inj({ method: "POST", url: "/api/auth/recovery/initiate", headers: json, payload: JSON.stringify({ method: "email", email: "owner@midukandar.demo" }) });
    const vo = await inj({ method: "POST", url: "/api/auth/recovery/verify-otp", headers: json, payload: JSON.stringify({ identifier: "owner@midukandar.demo", otp: "000000" }) });
    const rt = (vo.json() as any).resetToken;
    if (init.statusCode === 200 && rt) {
      const u1 = await inj({ method: "POST", url: "/api/auth/recovery/reset-pin", headers: json, payload: JSON.stringify({ resetToken: rt, newPin: "1357", confirmPin: "1357" }) });
      const u2 = await inj({ method: "POST", url: "/api/auth/recovery/reset-pin", headers: json, payload: JSON.stringify({ resetToken: rt, newPin: "9753", confirmPin: "9753" }) });
      rec("Area5 auth", "reset-token replay (single-use?)", u1.statusCode === 200 && u2.statusCode === 200 ? "REPLAYABLE" : "PASS", `first=${u1.statusCode} replay=${u2.statusCode}`);
    } else {
      rec("Area5 auth", "reset-token replay", "UNVERIFIED", `initiate=${init.statusCode} resetToken=${Boolean(rt)}`);
    }
  } catch (e) {
    rec("Area5 auth", "suite", "ERROR", (e as Error).message);
  }

  // ───────────────────────── Area 3: upload magic bytes (logic only) ─────────────────────────
  rec("Area3 upload", "magic-byte logic vs real signatures", "BUG", "real PNG/JPEG/GIF all REJECTED; bogus-byte junk ACCEPTED (see separate node repro)");

  // ───────────────────────── cleanup ─────────────────────────
  try {
    if (saleIds.length) {
      const ids = saleIds.filter(Boolean);
      await pool.query(`DELETE FROM udhaari_entries WHERE sale_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM payments WHERE sale_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM ledger_entries WHERE reference_type='SALE' AND reference_id = ANY($1::text[])`, [ids]);
      await pool.query(`DELETE FROM stock_movements WHERE reference_type='SALE' AND reference_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM sale_items WHERE sale_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM sales WHERE id = ANY($1::uuid[])`, [ids]);
    }
    if (productIds.length) {
      const ids = productIds.filter(Boolean);
      await pool.query(`DELETE FROM stock_movements WHERE product_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [ids]);
    }
    if (customerIds.length) {
      const ids = customerIds.filter(Boolean);
      await pool.query(`DELETE FROM ledger_entries WHERE customer_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM payments WHERE customer_id = ANY($1::uuid[])`, [ids]);
      await pool.query(`DELETE FROM customers WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await pool.query(`DELETE FROM held_bills WHERE bill_number LIKE 'HLD-%' AND store_id = (SELECT id FROM stores WHERE id='e9f8f5c3-ba70-4e63-9d36-15da3ac41885')`);
    rec("cleanup", "throwaway rows removed", "PASS");
  } catch (e) {
    rec("cleanup", "best-effort", "WARN", (e as Error).message);
  }

  console.log("\n===== SUMMARY =====");
  const byStatus: Record<string, number> = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  console.log(JSON.stringify(byStatus, null, 2));
  console.log(`total checks: ${results.length}`);

  await app.close();
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("[audit] FATAL:", e instanceof Error ? e.stack : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
