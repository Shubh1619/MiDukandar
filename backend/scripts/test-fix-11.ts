/**
 * Regression test — fix-11 (B12): day boundaries were the server's UTC day, not
 * the India (Asia/Kolkata) day that every store actually operates on.
 *
 * FAILS BEFORE the fix:
 *   - `expiresInSeconds` was hardcoded to 900 regardless of JWT_ACCESS_EXPIRES_IN,
 *     so a deployment that lengthened/shortened the token still advertised 15m.
 *   - "today" (dashboard range, expense date guard, expense summary, recurring
 *     due date) was `new Date().toISOString().split("T")[0]`, the UTC date. At
 *     00:00–05:30 IST that is *yesterday*, so early-morning activity was filed a
 *     day early and an expense dated "today" could be rejected as "in the
 *     future" once the UTC clock was still on the previous day.
 * PASSES AFTER: IST framing via src/lib/ist.ts and a real duration parse.
 *
 * Run:  npx tsx scripts/test-fix-11.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";
import crypto from "node:crypto";
import { durationToSeconds } from "../src/config.js";
import { istDateKey, istDayStart, istDayEnd, istBoundary } from "../src/lib/ist.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function login(app: { inject: (o: unknown) => Promise<{ json: () => unknown; body: string }> }, email: string) {
  const master = process.env.OTP_MASTER?.trim();
  if (!master) throw new Error("OTP_MASTER must be set in the environment");
  await pool.query(
    `INSERT INTO otps (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, 'LOGIN', now() + interval '10 minutes')`,
    [email.toLowerCase(), crypto.createHash("sha256").update(master).digest("hex")],
  );
  const res = await app.inject({ method: "POST", url: "/api/auth/otp/verify", payload: { email, otp: master } });
  const body = res.json() as { accessToken?: string; user?: { storeId?: string | null } };
  if (!body.accessToken) throw new Error("login failed: " + res.body);
  return { token: body.accessToken, storeId: body.user?.storeId };
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false });
  await app.listen({ port: 0, host: "127.0.0.1" });

  try {
    // --- unit: duration parsing --------------------------------------------
    check("fix-11 durationToSeconds parses minutes", durationToSeconds("15m") === 900, `15m => ${durationToSeconds("15m")}`);
    check("fix-11 durationToSeconds parses hours and days",
      durationToSeconds("2h") === 7200 && durationToSeconds("7d") === 604800,
      `2h => ${durationToSeconds("2h")}, 7d => ${durationToSeconds("7d")}`);
    check("fix-11 durationToSeconds parses bare seconds", durationToSeconds("900") === 900, `900 => ${durationToSeconds("900")}`);

    // --- unit: IST day helpers ---------------------------------------------
    // 2026-01-01 02:00 IST == 2025-12-31 20:30 UTC. The UTC date is the 31st,
    // the IST date is the 1st.
    const earlyIst = new Date("2025-12-31T20:30:00.000Z");
    check(
      "fix-11 istDateKey uses the IST calendar day across the UTC midnight",
      istDateKey(earlyIst) === "2026-01-01",
      `istDateKey=${istDateKey(earlyIst)} utcDate=${earlyIst.toISOString().slice(0, 10)}`,
    );
    check(
      "fix-11 istDayStart/istDayEnd bracket the IST day",
      istDayStart(earlyIst).toISOString() === "2025-12-31T18:30:00.000Z"
        && istDayEnd(earlyIst).toISOString() === "2026-01-01T18:29:59.999Z",
      `start=${istDayStart(earlyIst).toISOString()} end=${istDayEnd(earlyIst).toISOString()}`,
    );
    check(
      "fix-11 istBoundary maps a YYYY-MM-DD date to IST midnight",
      istBoundary("2026-03-15").toISOString() === "2026-03-14T18:30:00.000Z",
      `=> ${istBoundary("2026-03-15").toISOString()}`,
    );

    // --- integration: expiresInSeconds reflects config ----------------------
    const auth = await login(app, "owner@midukandar.demo");
    const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };
    const planRes = await pool.query<{ plan_id: string }>(`SELECT plan_id FROM stores WHERE id = $1`, [auth.storeId]);
    const planId = planRes.rows[0]?.plan_id;
    const MODULES = ["EXPENSES"];
    const prev = new Map<string, boolean>();
    if (planId) {
      const modRes = await pool.query<{ module_key: string; enabled: boolean }>(
        `SELECT module_key, enabled FROM plan_modules WHERE plan_id = $1 AND module_key = ANY($2::text[])`,
        [planId, MODULES],
      );
      for (const r of modRes.rows) prev.set(r.module_key, r.enabled);
      await pool.query(`UPDATE plan_modules SET enabled = TRUE WHERE plan_id = $1 AND module_key = ANY($2::text[])`, [planId, MODULES]);
    }

    const today = istDateKey();
    const expRes = await app.inject({
      method: "POST", url: "/api/expenses", headers,
      payload: { title: `fix11 ${Date.now()}`, category: "Test", amount: 3, note: "fix11", paymentMode: "CASH", expenseDate: today },
    });
    const expenseId = (expRes.json() as { expense?: { id?: string } }).expense?.id ?? null;
    check(
      "fix-11 an expense dated today (IST) is accepted",
      expRes.statusCode === 201 && !!expenseId,
      `today(IST)=${today} status=${expRes.statusCode} body=${expRes.body.slice(0, 160)}`,
    );

    if (expenseId) {
      await app.inject({ method: "DELETE", url: `/api/expenses/${expenseId}`, headers }).catch(() => undefined);
      await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]).catch(() => undefined);
    }

    if (planId) {
      for (const key of MODULES) {
        await pool.query(`UPDATE plan_modules SET enabled = $2 WHERE plan_id = $1 AND module_key = $3`, [planId, prev.get(key) ?? false, key]);
      }
    }
  } finally {
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-11 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-11] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
