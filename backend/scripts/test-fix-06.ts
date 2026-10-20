/**
 * Regression test — fix-06: expense and recurring-expense deletes reported
 * success for a row that was never deleted.
 *
 * FAILS BEFORE the fix: `deleteExpense`/`deleteRecurringExpense` discarded the
 *   DELETE result and returned `true`, so
 *   DELETE /api/expenses/:id and DELETE /api/recurring-expenses/:id answered
 *   {ok: true} for an unknown id or an id belonging to another store.
 * PASSES AFTER: the row count decides — 0 rows answered 404 NOT_FOUND, a real
 *   delete still answers {ok: true}.
 *
 * Plan-module gating: EXPENSES is enabled for the run and restored after.
 *
 * Run:  npx tsx scripts/test-fix-06.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

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
  const MODULES = ["EXPENSES"];
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

  let expenseId: string | null = null;
  let recurringId: string | null = null;

  try {
    const expenseRes = await app.inject({
      method: "POST", url: "/api/expenses", headers,
      payload: { title: "fix-06 expense", amount: 42, paymentMode: "CASH" },
    });
    expenseId = (expenseRes.json() as { expense?: { id?: string } }).expense?.id ?? null;
    check("fixtures: expense created", expenseRes.statusCode === 201 && !!expenseId, `status=${expenseRes.statusCode}`);

    if (expenseId) {
      const real = await app.inject({ method: "DELETE", url: `/api/expenses/${expenseId}`, headers });
      check("fix-06 deleting a real expense answers 200", real.statusCode === 200, `status=${real.statusCode} ${real.body.slice(0, 120)}`);
      expenseId = null;
    }

    const ghost = await app.inject({ method: "DELETE", url: `/api/expenses/${MISSING_ID}`, headers });
    const ghostBody = ghost.json() as { code?: string; ok?: boolean };
    check(
      "fix-06 deleting an unknown expense answers 404",
      ghost.statusCode === 404 && ghostBody.code === "NOT_FOUND",
      `status=${ghost.statusCode} body=${ghost.body.slice(0, 160)}`,
    );

    const dueDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const recRes = await app.inject({
      method: "POST", url: "/api/recurring-expenses", headers,
      payload: { title: "fix-06 recurring", amount: 99, frequency: "MONTHLY", nextDueDate: dueDate, paymentMode: "CASH" },
    });
    recurringId = (recRes.json() as { recurring?: { id?: string } }).recurring?.id ?? null;
    check("fixtures: recurring expense created", recRes.statusCode === 201 && !!recurringId, `status=${recRes.statusCode}`);

    if (recurringId) {
      const realRec = await app.inject({ method: "DELETE", url: `/api/recurring-expenses/${recurringId}`, headers });
      check("fix-06 deleting a real recurring expense answers 200", realRec.statusCode === 200, `status=${realRec.statusCode}`);
      recurringId = null;
    }

    const ghostRec = await app.inject({ method: "DELETE", url: `/api/recurring-expenses/${MISSING_ID}`, headers });
    const ghostRecBody = ghostRec.json() as { code?: string; ok?: boolean };
    check(
      "fix-06 deleting an unknown recurring expense answers 404",
      ghostRec.statusCode === 404 && ghostRecBody.code === "NOT_FOUND",
      `status=${ghostRec.statusCode} body=${ghostRec.body.slice(0, 160)}`,
    );
  } finally {
    if (expenseId) await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]).catch(() => undefined);
    if (recurringId) await pool.query(`DELETE FROM recurring_expenses WHERE id = $1`, [recurringId]).catch(() => undefined);
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

  console.log(failed === 0 ? "\nALL FIX-06 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-06] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
