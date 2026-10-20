/**
 * Regression test — fix-01: /api/expense-categories is served by the expense
 * CRUD plugin instead of the expense-category plugin.
 *
 * FAILS BEFORE the fix: `expenseRoutes` is mounted at BOTH /api/expenses and
 *   /api/expense-categories, so the bare "/" and "/:id" handlers of the
 *   expenses plugin own /api/expense-categories — POST /api/expense-categories
 *   with {name} answers 400 "Title is required" (expense create) and
 *   GET /api/expense-categories answers the paginated expense list
 *   ({total, expenses}), not categories.
 * PASSES AFTER: expenseCategoryRoutes owns that prefix — POST answers 201
 *   {category}, GET answers {categories}. The legacy /categories paths still
 *   answer {categories} (and POST still creates a category).
 *
 * /api/expense-categories is gated behind the EXPENSES plan module, which the
 * demo Free plan may not have — it is enabled for the run and restored after.
 *
 * Run:  npx tsx scripts/test-fix-01.ts     (exit 0 = PASS, 1 = FAIL)
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
  const port = (app.server.address() as { port: number }).port;
  void port;

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

  try {
    // ================= fix-01: expense-category routing =====================
    const restName = `fix01 rest ${Date.now()}`;
    const restCreate = await app.inject({
      method: "POST", url: "/api/expense-categories", headers, payload: { name: restName },
    });
    const restBody = restCreate.json() as { category?: { id?: string }; expense?: unknown; message?: string; code?: string };
    check(
      "fix-01 POST /api/expense-categories creates a category (201 + category.id)",
      restCreate.statusCode === 201 && !!restBody.category?.id,
      `status=${restCreate.statusCode} body=${restCreate.body.slice(0, 240)}`,
    );
    const restCatId = restBody.category?.id;

    const restList = await app.inject({ method: "GET", url: "/api/expense-categories", headers });
    const restListBody = restList.json() as { categories?: unknown[]; total?: unknown; expenses?: unknown[] };
    check(
      "fix-01 GET /api/expense-categories answers {categories}",
      restList.statusCode === 200 && Array.isArray(restListBody.categories)
        && restListBody.total === undefined && restListBody.expenses === undefined,
      `status=${restList.statusCode} keys=${Object.keys(restListBody).join(",")}`,
    );
    check(
      "fix-01 created category is listed",
      Array.isArray(restListBody.categories)
        && restListBody.categories.some((c) => (c as { id?: string }).id === restCatId),
    );

    const legacyName = `fix01 legacy ${Date.now()}`;
    const legacyCreate = await app.inject({
      method: "POST", url: "/api/expense-categories/categories", headers, payload: { name: legacyName },
    });
    const legacyBody = legacyCreate.json() as { category?: { id?: string } };
    check(
      "fix-01 POST /api/expense-categories/categories still creates a category",
      legacyCreate.statusCode === 201 && !!legacyBody.category?.id,
      `status=${legacyCreate.statusCode} body=${legacyCreate.body.slice(0, 240)}`,
    );

    const legacyList = await app.inject({ method: "GET", url: "/api/expense-categories/categories", headers });
    const legacyListBody = legacyList.json() as { categories?: unknown[] };
    check(
      "fix-01 GET /api/expense-categories/categories still answers {categories}",
      legacyList.statusCode === 200 && Array.isArray(legacyListBody.categories),
      `status=${legacyList.statusCode}`,
    );

    // cleanup so reruns stay deterministic
    if (restCatId) {
      const del = await app.inject({ method: "DELETE", url: `/api/expense-categories/${restCatId}`, headers });
      check("fix-01 DELETE /api/expense-categories/:id", del.statusCode === 200, `status=${del.statusCode}`);
    }
    if (legacyBody.category?.id) {
      const del = await app.inject({
        method: "DELETE", url: `/api/expense-categories/categories/${legacyBody.category.id}`, headers,
      });
      check("fix-01 DELETE /api/expense-categories/categories/:id", del.statusCode === 200, `status=${del.statusCode}`);
    }
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

  console.log(failed === 0 ? "\nALL FIX-01 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-01] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
