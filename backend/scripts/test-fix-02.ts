/**
 * Regression test — fix-02: query booleans parsed with z.coerce.boolean().
 *
 * FAILS BEFORE the fix: `Boolean("false") === true`, so
 *   GET /api/inventory/stock/current?lowOnly=false and
 *   GET /api/reports/stock/current?lowOnly=false both behave as lowOnly=true
 *   (only low rows) while omitting the parameter returns everything. The same
 *   inversion applies to `withBalance` on GET /api/customers.
 * PASSES AFTER: ?lowOnly=false returns the same id set as omitting the
 *   parameter, ?lowOnly=true is a subset of it, and ?withBalance=false leaves
 *   the response shape identical to omitting it.
 *
 * /api/inventory and /api/reports are gated behind the INVENTORY and
 * GST_REPORTS plan modules, which the demo Free plan may not have — they are
 * enabled for the run and restored after.
 *
 * Run:  npx tsx scripts/test-fix-02.ts     (exit 0 = PASS, 1 = FAIL)
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

  // --- login (same contract as smoke.ts) -----------------------------------
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

  // --- open the plan modules these routes are gated behind ------------------
  const planRes = await pool.query<{ plan_id: string }>(
    `SELECT plan_id FROM stores WHERE id = $1`, [storeId],
  );
  const planId = planRes.rows[0]?.plan_id;
  const MODULES = ["INVENTORY", "GST_REPORTS", "CUSTOMERS_UDHAARI"];
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

  try {
    const ids = (body: unknown): string[] =>
      (((body as { stock?: { id?: string }[] }).stock ?? [])).map((r) => String(r.id)).sort();

    // --- /api/inventory/stock/current --------------------------------------
    const invDef = await app.inject({ method: "GET", url: "/api/inventory/stock/current", headers });
    const invOff = await app.inject({ method: "GET", url: "/api/inventory/stock/current?lowOnly=false", headers });
    const invOn = await app.inject({ method: "GET", url: "/api/inventory/stock/current?lowOnly=true", headers });

    const defIds = ids(invDef.json());
    const offIds = ids(invOff.json());
    const onIds = ids(invOn.json());
    check(
      "fix-02 inventory ?lowOnly=false behaves like no parameter",
      invDef.statusCode === 200 && invOff.statusCode === 200
        && defIds.length === offIds.length && defIds.every((v, i) => v === offIds[i]),
      `default=${defIds.length} lowOnly=false=${offIds.length}`,
    );
    check(
      "fix-02 inventory ?lowOnly=true is a subset of the full list",
      invOn.statusCode === 200 && onIds.length <= offIds.length && onIds.every((v) => defIds.includes(v)),
      `lowOnly=true=${onIds.length} default=${defIds.length}`,
    );

    // --- /api/reports/stock/current ----------------------------------------
    const repDef = await app.inject({ method: "GET", url: "/api/reports/stock/current", headers });
    const repOff = await app.inject({ method: "GET", url: "/api/reports/stock/current?lowOnly=false", headers });
    const repOn = await app.inject({ method: "GET", url: "/api/reports/stock/current?lowOnly=true", headers });
    const rDef = ids(repDef.json());
    const rOff = ids(repOff.json());
    const rOn = ids(repOn.json());
    check(
      "fix-02 reports ?lowOnly=false behaves like no parameter",
      repDef.statusCode === 200 && repOff.statusCode === 200
        && rDef.length === rOff.length && rDef.every((v, i) => v === rOff[i]),
      `default=${rDef.length} lowOnly=false=${rOff.length}`,
    );
    check(
      "fix-02 reports ?lowOnly=true is a subset of the full list",
      repOn.statusCode === 200 && rOn.length <= rOff.length && rOn.every((v) => rDef.includes(v)),
      `lowOnly=true=${rOn.length} default=${rDef.length}`,
    );

    // --- /api/customers?withBalance ----------------------------------------
    // Before the fix the response carried `outstanding` either way (the flag
    // was parsed but unused), so assert only that ?withBalance=false does not
    // change the shape relative to omitting it.
    const custDef = await app.inject({ method: "GET", url: "/api/customers?limit=5", headers });
    const custOff = await app.inject({ method: "GET", url: "/api/customers?limit=5&withBalance=false", headers });
    const custOn = await app.inject({ method: "GET", url: "/api/customers?limit=5&withBalance=true", headers });
    const shape = (b: unknown): string => JSON.stringify(Object.keys((b as { customers?: unknown[] }).customers?.[0] ?? {}).sort());
    check(
      "fix-02 customers ?withBalance=false shape equals default",
      custDef.statusCode === 200 && custOff.statusCode === 200 && shape(custDef.json()) === shape(custOff.json()),
      `default keys=${shape(custDef.json())} false keys=${shape(custOff.json())}`,
    );
    check(
      "fix-02 customers list responds for all three withBalance forms",
      custOn.statusCode === 200,
      `withBalance=true status=${custOn.statusCode}`,
    );
  } finally {
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

  console.log(failed === 0 ? "\nALL FIX-02 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-02] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
