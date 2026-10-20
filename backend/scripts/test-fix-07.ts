/**
 * Regression test — fix-07: recurring-expense materialisation.
 *
 * FAILS BEFORE the fix:
 *   (a) Month-end overflow — next due 2026-01-31 was advanced with
 *       `Date.setMonth(getMonth() + 1)`, which overflows to 2026-03-03 (Feb 31
 *       normalises into March), silently skipping February.
 *   (b) Race — the list handler called processDueRecurringExpenses over a bare
 *       pool client with no lock, so two concurrent GET
 *       /api/recurring-expenses could materialise the same period twice.
 *   (c) nextDueDate was accepted as any string and only failed later inside a
 *       `$::date` cast (500 instead of 400).
 * PASSES AFTER: 2026-01-31 → 2026-02-28 (clamped to the target month), due
 *   rows are taken with FOR UPDATE SKIP LOCKED inside a transaction so parallel
 *   list loads create exactly one expense, and a malformed date is rejected
 *   with 400 VALIDATION_ERROR.
 *
 * Plan-module gating: EXPENSES is enabled for the run and restored after.
 *
 * Run:  npx tsx scripts/test-fix-07.ts     (exit 0 = PASS, 1 = FAIL)
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

  const title = `fix-07 monthend ${Date.now()}`;
  let recurringId: string | null = null;
  const expenseCount = async (): Promise<number> => {
    const r = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM expenses WHERE store_id = $1 AND title = $2`,
      [storeId, title],
    );
    return Number(r.rows[0]?.c ?? 0);
  };

  try {
    // --- (c) malformed nextDueDate is a validation error ---------------------
    const badDate = await app.inject({
      method: "POST", url: "/api/recurring-expenses", headers,
      payload: { title, amount: 55, frequency: "MONTHLY", nextDueDate: "31-01-2026", paymentMode: "CASH" },
    });
    check(
      "fix-07 malformed nextDueDate is rejected with 400",
      badDate.statusCode === 400,
      `status=${badDate.statusCode} body=${badDate.body.slice(0, 160)}`,
    );

    // --- create a due recurring expense on a month end -----------------------
    const createRes = await app.inject({
      method: "POST", url: "/api/recurring-expenses", headers,
      payload: { title, amount: 55, frequency: "MONTHLY", nextDueDate: "2026-01-31", paymentMode: "CASH" },
    });
    recurringId = (createRes.json() as { recurring?: { id?: string } }).recurring?.id ?? null;
    check("fixtures: month-end recurring expense created", createRes.statusCode === 201 && !!recurringId, `status=${createRes.statusCode}`);

    // --- (a) first list load materialises it and clamps the next due date ----
    const list1 = await app.inject({ method: "GET", url: "/api/recurring-expenses", headers });
    const rec1 = (list1.json() as { recurring?: { id?: string; nextDueDate?: string }[] })
      .recurring?.find((r) => r.id === recurringId);
    check(
      "fix-07 next due advances 2026-01-31 → 2026-02-28 (no overflow)",
      rec1?.nextDueDate === "2026-02-28",
      `nextDueDate=${rec1?.nextDueDate} (expected 2026-02-28; overflow value would be 2026-03-03)`,
    );
    check(
      "fix-07 first list load materialised exactly one expense",
      (await expenseCount()) === 1,
      `count=${await expenseCount()}`,
    );

    // --- (b) race: reset to a fresh due period, then hammer the list ---------
    await pool.query(
      `UPDATE recurring_expenses SET next_due_date = '2026-10-01'::date WHERE id = $1`,
      [recurringId],
    );
    const baseline = await expenseCount();

    const parallel = await Promise.all(
      Array.from({ length: 5 }, () => app.inject({ method: "GET", url: "/api/recurring-expenses", headers })),
    );
    const parallelOk = parallel.every((r) => r.statusCode === 200);
    const afterParallel = await expenseCount();
    check(
      "fix-07 five concurrent list loads materialise the due period exactly once",
      parallelOk && afterParallel === baseline + 1,
      `statuses=${parallel.map((r) => r.statusCode).join(",")} baseline=${baseline} after=${afterParallel}`,
    );

    // --- a subsequent load must be idempotent (nothing is due any more) ------
    const repeat = await app.inject({ method: "GET", url: "/api/recurring-expenses", headers });
    check(
      "fix-07 follow-up list load is idempotent",
      repeat.statusCode === 200 && (await expenseCount()) === afterParallel,
      `count=${await expenseCount()} expected=${afterParallel}`,
    );

    // --- the manual endpoint still reports 0 when nothing is due ------------
    const processDue = await app.inject({
      method: "POST", url: "/api/recurring-expenses/recurring/process-due", headers,
    });
    const processBody = processDue.json() as { createdCount?: number };
    check(
      "fix-07 POST process-due reports 0 when nothing is due",
      processDue.statusCode === 200 && processBody.createdCount === 0,
      `status=${processDue.statusCode} createdCount=${processBody.createdCount}`,
    );

    // --- malformed date on an existing row cannot be written back ------------
    const badPatch = await app.inject({
      method: "PATCH", url: `/api/recurring-expenses/${recurringId}`, headers,
      payload: { nextDueDate: "not-a-date" },
    });
    check(
      "fix-07 PATCH rejects a malformed nextDueDate with 400",
      badPatch.statusCode === 400,
      `status=${badPatch.statusCode} body=${badPatch.body.slice(0, 160)}`,
    );
  } finally {
    if (recurringId) {
      await pool.query(`DELETE FROM recurring_expenses WHERE id = $1`, [recurringId]).catch(() => undefined);
    }
    await pool.query(`DELETE FROM recurring_expenses WHERE store_id = $1 AND title = $2`, [storeId, title])
      .catch(() => undefined);
    await pool.query(`DELETE FROM expenses WHERE store_id = $1 AND title = $2`, [storeId, title]).catch(() => undefined);
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

  console.log(failed === 0 ? "\nALL FIX-07 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-07] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
