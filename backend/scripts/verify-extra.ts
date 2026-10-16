/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

const json = { "content-type": "application/json" };

async function main() {
  const app = buildApp({ logger: false });
  const inj = (o: any) => app.inject(o);
  const H = (t: string) => ({ authorization: `Bearer ${t}`, ...json });

  async function login(email: string): Promise<string> {
    const r1 = await inj({ method: "POST", url: "/api/auth/otp/request", payload: JSON.stringify({ email }), headers: json });
    const otp = (r1.json() as any).devOtp;
    if (!otp) throw new Error(`no devOtp for ${email}: ${r1.statusCode} ${r1.body}`);
    const r = await inj({ method: "POST", url: "/api/auth/otp/verify", payload: JSON.stringify({ email, otp }), headers: json });
    const tok = (r.json() as any).accessToken;
    if (!tok) throw new Error(`login failed for ${email}: ${r.statusCode} ${r.body}`);
    return tok;
  }

  const tokB = await login("owner@mazedukan.demo"); // Pro store e9f8
  const tokA = await login("owner@midukandar.demo"); // Free store f457
  console.log("login ok");

  // (A) Flutter path: POST /api/suppliers/invoice (no :id)
  const a = await inj({ method: "POST", url: "/api/suppliers/invoice", headers: H(tokB), payload: JSON.stringify({ lines: [] }) });
  console.log(`A) POST /api/suppliers/invoice => ${a.statusCode} (Flutter expects this; backend has no such route)`);

  // (B) backend route with :id -> 500 due to withTx passed as db
  const cs = await inj({ method: "POST", url: "/api/suppliers", headers: H(tokB), payload: JSON.stringify({ name: "VERIFY_SUP", mobile: "9000000999" }) });
  const supId = (cs.json() as any).supplier?.id as string;
  const b = await inj({ method: "POST", url: `/api/suppliers/${supId}/invoice`, headers: H(tokB), payload: JSON.stringify({ lines: [{ productName: "X", qty: 1, unitPrice: 10, gstPercent: 0 }] }) });
  console.log(`B) POST /api/suppliers/:id/invoice => ${b.statusCode} ${(b.json() as any).code ?? ""} (want 201)`);

  // (C) import Infinity row -> does it 500 or import?
  const c = await inj({ method: "POST", url: "/api/products/import", headers: H(tokB), payload: JSON.stringify({ mode: "skip", rows: [{ name: "VERIFY_INF", purchasePrice: 1e999 }] }) });
  console.log(`C) import purchasePrice=1e999 => ${c.statusCode} ${JSON.stringify((c.json() as any)).slice(0, 160)}`);

  // (D) PUT /api/sales/:id with Flutter's partial payload (no lines) -> 400
  const prod = await inj({ method: "POST", url: "/api/products", headers: H(tokB), payload: JSON.stringify({ name: "VERIFY_PROD", sellingPrice: 100, purchasePrice: 60, gstPercent: 0, openingStock: 10 }) });
  const pid = (prod.json() as any).product?.id as string;
  const sale = await inj({ method: "POST", url: "/api/sales", headers: H(tokB), payload: JSON.stringify({ lines: [{ productId: pid, qty: 1, unitPrice: 100, gstPercent: 0 }], paymentMode: "CASH", paidAmount: 100 }) });
  const sid = (sale.json() as any).sale?.id as string;
  const d = await inj({ method: "PUT", url: `/api/sales/${sid}`, headers: H(tokB), payload: JSON.stringify({ customer: { name: "Walk-in" }, paymentMode: "CASH", paidAmount: 0, notes: "x" }) });
  console.log(`D) PUT /api/sales/:id partial(no lines) => ${d.statusCode} ${(d.json() as any).code ?? ""} (want 400)`);

  // (E) refresh rotation reuse: what happens on replay of a rotated token?
  const rreq = await inj({ method: "POST", url: "/api/auth/otp/verify", payload: JSON.stringify({ email: "owner@mazedukan.demo", otp: "000000" }), headers: json });
  const refresh1 = (rreq.json() as any).refreshToken;
  console.log("E) login returned refreshToken in body?", Boolean(refresh1));

  await app.close();

  // cleanup best-effort
  try {
    const sup = await pool.query(`SELECT id FROM suppliers WHERE name='VERIFY_SUP'`);
    for (const row of sup.rows) {
      await pool.query(`DELETE FROM supplier_payments WHERE supplier_id=$1`, [row.id]);
      await pool.query(`DELETE FROM suppliers WHERE id=$1`, [row.id]);
    }
    const prods = await pool.query(`SELECT id FROM products WHERE name IN ('VERIFY_PROD','VERIFY_INF')`);
    const pids = prods.rows.map((r) => r.id);
    if (pids.length) {
      await pool.query(`DELETE FROM stock_movements WHERE product_id = ANY($1::uuid[])`, [pids]);
      const sales = await pool.query(`SELECT id FROM sales WHERE id IN (SELECT sale_id FROM sale_items WHERE product_id = ANY($1::uuid[]))`, [pids]);
      const sids = sales.rows.map((r) => r.id);
      if (sids.length) {
        await pool.query(`DELETE FROM sale_items WHERE sale_id = ANY($1::uuid[])`, [sids]);
        await pool.query(`DELETE FROM payments WHERE sale_id = ANY($1::uuid[])`, [sids]);
        await pool.query(`DELETE FROM ledger_entries WHERE reference_id = ANY($1::text[])`, [sids.map(String)]);
        await pool.query(`DELETE FROM sales WHERE id = ANY($1::uuid[])`, [sids]);
      }
      await pool.query(`DELETE FROM products WHERE id = ANY($1::uuid[])`, [pids]);
    }
    console.log("cleanup done");
  } catch (e) {
    console.log("cleanup warn:", String(e));
  }
  await pool.end();
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
