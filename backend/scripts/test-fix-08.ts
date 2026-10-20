/**
 * Regression test — fix-08: DELETE /api/users/:id returned 500 for any user
 * with recorded activity.
 *
 * FAILS BEFORE the fix (constraints at their default NO ACTION): every audit
 *   FK (sales, purchases, stock_movements, payments, held_bills,
 *   udhaari_entries, udhaari_payments, purchase_orders, supplier_payments →
 *   users(id)) rejected the delete with SQLSTATE 23503 → 500 INTERNAL_ERROR,
 *   so the only way to remove a user was deactivating them.
 * PASSES AFTER: migration 020 rewrote those ten constraints to ON DELETE
 *   SET NULL — DELETE /api/users/:id answers 204, the user row is gone, and
 *   the historical rows keep their numbers with created_by_id nulled.
 *
 * Plan-module gating: USERS_ROLES and EXPENSES are enabled for the run and
 * restored after.
 *
 * Run:  npx tsx scripts/test-fix-08.ts     (exit 0 = PASS, 1 = FAIL)
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
  const MODULES = ["USERS_ROLES", "EXPENSES"];
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

  const title = `fix-08 attribution ${Date.now()}`;
  const staffEmail = `fix08-${Date.now()}@test.invalid`;
  let expenseId: string | null = null;

  try {
    // the demo Free plan allows ONE non-owner user; drop leftovers from earlier
    // fix runs so the fixture below is not blocked by the plan limit.
    await pool.query(
      `DELETE FROM users WHERE store_id = $1 AND email LIKE 'fix0%' AND email LIKE '%@test.invalid'`,
      [storeId],
    );

    // --- fixture: staff member + an expense attributed to them ---------------
    const addRes = await app.inject({
      method: "POST", url: "/api/store/staff", headers,
      payload: { email: staffEmail, name: "Fix08 Staff", role: "CASHIER" },
    });
    check("fixtures: staff added", addRes.statusCode === 201, `status=${addRes.statusCode}`);
    const staffRow = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [staffEmail]);
    const staffId = staffRow.rows[0]?.id;
    if (!staffId) throw new Error("staff member not found after create");

    const expenseRes = await app.inject({
      method: "POST", url: "/api/expenses", headers,
      payload: { title, amount: 17, paymentMode: "CASH" },
    });
    expenseId = (expenseRes.json() as { expense?: { id?: string } }).expense?.id ?? null;
    check("fixtures: expense created", expenseRes.statusCode === 201 && !!expenseId, `status=${expenseRes.statusCode}`);
    await pool.query(`UPDATE expenses SET created_by_id = $1 WHERE id = $2`, [staffId, expenseId]);

    // --- the delete itself ---------------------------------------------------
    const del = await app.inject({ method: "DELETE", url: `/api/users/${staffId}`, headers });
    check(
      "fix-08 DELETE /api/users/:id answers 204",
      del.statusCode === 204,
      `status=${del.statusCode} body=${del.body.slice(0, 200)}`,
    );

    const gone = await pool.query(`SELECT id FROM users WHERE id = $1`, [staffId]);
    check("fix-08 the user row is gone", gone.rows.length === 0, `rows=${gone.rows.length}`);

    const surviving = await pool.query<{ created_by_id: string | null }>(
      `SELECT created_by_id FROM expenses WHERE id = $1`, [expenseId],
    );
    check(
      "fix-08 the historical expense survives with created_by_id nulled",
      surviving.rows.length === 1 && surviving.rows[0].created_by_id === null,
      `rows=${surviving.rows.length} created_by_id=${surviving.rows[0]?.created_by_id}`,
    );
  } finally {
    if (expenseId) {
      await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]).catch(() => undefined);
    }
    await pool.query(`DELETE FROM users WHERE email = $1 AND store_id = $2`, [staffEmail, storeId])
      .catch(() => undefined);
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

  console.log(failed === 0 ? "\nALL FIX-08 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-08] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
