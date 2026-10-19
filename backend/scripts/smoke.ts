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
  // The response deliberately no longer echoes the code (it used to return
  // `devOtp`, handing a valid login code to any caller); dev/test logins go
  // through the master OTP, which the environment supplies.
  if (otpRes.statusCode !== 200) throw new Error("otp request failed: " + otpRes.body);
  const masterOtp = process.env.OTP_MASTER?.trim();
  if (!masterOtp) throw new Error("OTP_MASTER must be set in the environment for smoke");
  log(`otp request ok (${otpRes.statusCode})`);

  const verifyRes = await app.inject({
    method: "POST", url: "/api/auth/otp/verify",
    payload: { email: "owner@midukandar.demo", otp: masterOtp },
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

  // Recurring expenses: create → list → toggle → delete. Regression guard for
  // the bare /api/recurring-expenses path being served by the one-time expense
  // handlers (which stripped `frequency`/`nextDueDate`).
  //
  // The demo store is on the Free plan, which does not include the EXPENSES
  // module, so enable it on the store's plan for the duration of this check and
  // restore the previous value afterwards.
  const planRes = await pool.query<{ plan_id: string }>(
    `SELECT plan_id FROM stores WHERE id = $1`,
    [auth.user?.storeId],
  );
  const planId = planRes.rows[0]?.plan_id;
  let prevExpensesEnabled: boolean | null = null;
  if (planId) {
    const modRes = await pool.query<{ enabled: boolean }>(
      `SELECT enabled FROM plan_modules WHERE plan_id = $1 AND module_key = 'EXPENSES'`,
      [planId],
    );
    prevExpensesEnabled = modRes.rows[0]?.enabled ?? null;
    await pool.query(
      `UPDATE plan_modules SET enabled = TRUE WHERE plan_id = $1 AND module_key = 'EXPENSES'`,
      [planId],
    );
  }

  const dueDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const recCreate = await app.inject({
    method: "POST", url: "/api/recurring-expenses",
    headers: bearer,
    payload: {
      title: "Smoke Recurring Rent",
      amount: 1234.56,
      frequency: "MONTHLY",
      nextDueDate: dueDate,
      paymentMode: "CASH",
    },
  });
  const recBody = recCreate.json() as { recurring?: { id?: string; frequency?: string } };
  if (recCreate.statusCode !== 201 || !recBody.recurring?.id) {
    throw new Error("recurring create failed: " + JSON.stringify(recBody));
  }
  if (recBody.recurring.frequency !== "MONTHLY") {
    throw new Error("recurring create lost frequency: " + JSON.stringify(recBody.recurring));
  }
  const recId = recBody.recurring.id;
  log(`recurring created id=${recId} frequency=${recBody.recurring.frequency}`);

  const recList = await app.inject({ method: "GET", url: "/api/recurring-expenses/recurring", headers: bearer });
  const recListBody = recList.json() as { recurring?: { id?: string }[] };
  if (!recListBody.recurring?.some((r) => r.id === recId)) {
    throw new Error("recurring not found in list: " + JSON.stringify(recListBody));
  }
  log(`recurring list ok (${recList.statusCode}) count=${recListBody.recurring.length}`);

  const recToggle = await app.inject({
    method: "PATCH", url: `/api/recurring-expenses/${recId}`,
    headers: bearer,
    payload: { isActive: false },
  });
  const recToggleBody = recToggle.json() as { recurring?: { isActive?: boolean } };
  if (recToggle.statusCode !== 200 || recToggleBody.recurring?.isActive !== false) {
    throw new Error("recurring toggle failed: " + JSON.stringify(recToggleBody));
  }
  log(`recurring toggle ok (${recToggle.statusCode}) isActive=${recToggleBody.recurring.isActive}`);

  const recDelete = await app.inject({
    method: "DELETE", url: `/api/recurring-expenses/${recId}`, headers: bearer,
  });
  if (recDelete.statusCode !== 200) throw new Error("recurring delete failed: " + JSON.stringify(recDelete.json()));
  log(`recurring delete ok (${recDelete.statusCode})`);

  if (planId && prevExpensesEnabled !== null) {
    await pool.query(
      `UPDATE plan_modules SET enabled = $2 WHERE plan_id = $1 AND module_key = 'EXPENSES'`,
      [planId, prevExpensesEnabled],
    );
  }

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