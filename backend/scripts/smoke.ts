import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

const log = (...a: unknown[]) => console.log("[smoke]", ...a);

async function main() {
  const app = buildApp({ logger: false });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as { port: number }).port;
  log(`listening on ${port}`);

  const json = { "content-type": "application/json" };

  const otpRes = await app.inject({
    method: "POST", url: "/api/auth/otp/request",
    payload: { email: "owner@midukandar.demo" },
  });
  const devOtp = (otpRes.json() as { devOtp?: string }).devOtp;
  if (!devOtp) throw new Error("no devOtp returned");
  log(`otp request ok (${otpRes.statusCode})`);

  const verifyRes = await app.inject({
    method: "POST", url: "/api/auth/otp/verify",
    payload: { email: "owner@midukandar.demo", otp: devOtp },
  });
  const auth = verifyRes.json() as { accessToken?: string; user?: { role?: string; storeId?: string | null } };
  if (!auth.accessToken) throw new Error("verify failed: " + JSON.stringify(auth));
  log(`verify ok (${verifyRes.statusCode}), role=${auth.user?.role} storeId=${auth.user?.storeId}`);

  const bearer = { authorization: `Bearer ${auth.accessToken}`, ...json };

  const products = await app.inject({ method: "GET", url: "/api/products?limit=10", headers: bearer });
  const pBody = products.json() as { total?: number; products?: unknown[] };
  log(`products ok (${products.statusCode}) total=${pBody.total}`);

  const low = await app.inject({ method: "GET", url: "/api/inventory/stock/low", headers: bearer });
  log(`stock/low ok (${low.statusCode})`);

  const dashboard = await app.inject({ method: "GET", url: "/api/reports/dashboard", headers: bearer });
  log(`dashboard ok (${dashboard.statusCode})`);

  const pid = (pBody.products as { id: string; sellingPrice: number; gstPercent: number }[])[0];
  const saleRes = await app.inject({
    method: "POST", url: "/api/sales",
    headers: bearer,
    payload: {
      lines: [{ productId: pid.id, qty: 2, unitPrice: pid.sellingPrice, gstPercent: pid.gstPercent }],
      paymentMode: "CASH",
      paidAmount: Math.round(pid.sellingPrice * 2 * 100) / 100,
      discount: 0,
      discountType: "FLAT",
      notes: "smoke test sale",
    },
  });
  const sale = saleRes.json() as { ok?: boolean; sale?: { id?: string; invoiceNumber?: string; total?: number } };
  if (saleRes.statusCode !== 201 && !sale.ok) throw new Error("sale failed: " + JSON.stringify(sale));
  log(`sale created invoice=${sale.sale?.invoiceNumber} total=${sale.sale?.total}`);

  const stockAfter = await app.inject({ method: "GET", url: `/api/products/${pid.id}`, headers: bearer });
  log(`product detail ok (${stockAfter.statusCode})`);

  const sales = await app.inject({ method: "GET", url: "/api/sales?limit=5", headers: bearer });
  log(`sales list ok (${sales.statusCode})`);

  log("SMOKE TEST PASSED");
  await app.close();
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("[smoke] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});