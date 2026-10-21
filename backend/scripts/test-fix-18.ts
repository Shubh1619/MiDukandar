/**
 * Regression test - fix-18: product expiry alert feed.
 *
 * Adds GET /api/products/expiring, which feeds the web dashboard popup +
 * inventory banner and the mobile alert dialog. It returns products already
 * expired and products expiring within a PER-STORE window
 * (stores.expiry_warning_days, default 30).
 *
 * FAILS BEFORE: the route 404s and there is no per-store window column.
 * PASSES AFTER: expired and near-expiry products are grouped correctly, a
 *   far-future product is excluded, and lowering the store window removes the
 *   "expiring soon" group.
 *
 * Run:  npx tsx scripts/test-fix-18.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";
import crypto from "node:crypto";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

type App = {
  inject: (o: unknown) => Promise<{ json: () => Record<string, unknown>; body: string; statusCode: number }>;
  listen: (o: unknown) => Promise<unknown>;
  close: () => Promise<void>;
};

async function login(app: App) {
  const master = process.env.OTP_MASTER?.trim();
  if (!master) throw new Error("OTP_MASTER must be set in the environment");
  await pool.query(
    `INSERT INTO otps (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, 'LOGIN', now() + interval '10 minutes')`,
    ["owner@midukandar.demo".toLowerCase(), crypto.createHash("sha256").update(master).digest("hex")],
  );
  const res = await app.inject({
    method: "POST", url: "/api/auth/otp/verify",
    payload: { email: "owner@midukandar.demo", otp: master },
  });
  const body = res.json() as { accessToken?: string; user?: { storeId?: string | null } };
  if (!body.accessToken) throw new Error("login failed: " + res.body);
  return { token: body.accessToken, storeId: body.user?.storeId as string };
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  await pool.query(`DELETE FROM otps`).catch(() => undefined);
  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false }) as unknown as App;
  await app.listen({ port: 0, host: "127.0.0.1" });

  const createdIds: string[] = [];
  let storeId = "";
  let originalWarning: number | null = null;

  try {
    const auth = await login(app);
    storeId = auth.storeId;
    const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };

    const storeRow = await pool.query<{ expiry_warning_days: number }>(
      `SELECT expiry_warning_days FROM stores WHERE id=$1`, [storeId],
    );
    originalWarning = storeRow.rows[0]?.expiry_warning_days ?? 30;

    // Ensure modules needed for product create are on.
    const planRow = await pool.query<{ plan_id: string | null }>(`SELECT plan_id FROM stores WHERE id=$1`, [storeId]);
    const planId = planRow.rows[0]?.plan_id;
    const prev = new Map<string, boolean>();
    if (planId) {
      const cur = await pool.query<{ module_key: string; enabled: boolean }>(
        `SELECT module_key, enabled FROM plan_modules WHERE plan_id=$1 AND module_key='PRODUCTS'`,
        [planId],
      );
      for (const r of cur.rows) prev.set(r.module_key, r.enabled);
      await pool.query(`UPDATE plan_modules SET enabled=TRUE WHERE plan_id=$1 AND module_key='PRODUCTS'`, [planId]);
    }

    const makeProduct = async (name: string, expiry: string) => {
      const res = await app.inject({
        method: "POST", url: "/api/products", headers,
        payload: { name, sellingPrice: 10, gstPercent: 0, expiryDate: expiry },
      });
      const id = (res.json() as { product?: { id?: string } }).product?.id;
      if (id) createdIds.push(id);
      return { status: res.statusCode, id, body: res.body };
    };

    const expired = await makeProduct(`fix18 expired ${Date.now()}`, isoDaysFromNow(-3));
    const soon = await makeProduct(`fix18 soon ${Date.now()}`, isoDaysFromNow(5));
    const far = await makeProduct(`fix18 far ${Date.now()}`, isoDaysFromNow(400));
    check(
      "fix-18 fixtures created",
      expired.status === 201 && soon.status === 201 && far.status === 201,
      `statuses=${expired.status},${soon.status},${far.status} body=${expired.body.slice(0, 120)}`,
    );

    // ---- default window (30 days) -----------------------------------------
    const res1 = await app.inject({ method: "GET", url: "/api/products/expiring", headers });
    const body1 = res1.json() as {
      expired?: Array<{ id: string }>;
      expiringSoon?: Array<{ id: string }>;
      warningDays?: number;
    };
    check("fix-18 GET /api/products/expiring answers 200", res1.statusCode === 200, `status=${res1.statusCode}`);
    check("fix-18 returns warningDays", typeof body1.warningDays === "number", `warningDays=${body1.warningDays}`);
    check(
      "fix-18 the past-dated product is in the expired group",
      !!body1.expired?.some((p) => p.id === expired.id),
      `expiredCount=${body1.expired?.length}`,
    );
    check(
      "fix-18 the near-future product is in the expiringSoon group",
      !!body1.expiringSoon?.some((p) => p.id === soon.id),
      `soonCount=${body1.expiringSoon?.length}`,
    );
    check(
      "fix-18 the far-future product is excluded",
      !body1.expired?.some((p) => p.id === far.id) && !body1.expiringSoon?.some((p) => p.id === far.id),
      `farInExpired=${body1.expired?.some((p) => p.id === far.id)} farInSoon=${body1.expiringSoon?.some((p) => p.id === far.id)}`,
    );

    // ---- per-store window: shrink to 2 days --------------------------------
    await pool.query(`UPDATE stores SET expiry_warning_days=2 WHERE id=$1`, [storeId]);
    const res2 = await app.inject({ method: "GET", url: "/api/products/expiring", headers });
    const body2 = res2.json() as { expiringSoon?: Array<{ id: string }>; warningDays?: number };
    check("fix-18 store window is applied", body2.warningDays === 2, `warningDays=${body2.warningDays}`);
    check(
      "fix-18 shrinking the window removes the near-future product from expiringSoon",
      !body2.expiringSoon?.some((p) => p.id === soon.id),
      `soonCount=${body2.expiringSoon?.length}`,
    );

    // ---- restore window ----------------------------------------------------
    if (planId && prev.size > 0) {
      for (const [key, enabled] of prev) {
        await pool.query(`UPDATE plan_modules SET enabled=$1 WHERE plan_id=$2 AND module_key=$3`, [enabled, planId, key]);
      }
    }
  } finally {
    if (originalWarning != null && storeId) {
      await pool.query(`UPDATE stores SET expiry_warning_days=$1 WHERE id=$2`, [originalWarning, storeId]).catch(() => undefined);
    }
    for (const id of createdIds) {
      await pool.query(`DELETE FROM stock_movements WHERE product_id=$1`, [id]).catch(() => undefined);
      await pool.query(`DELETE FROM products WHERE id=$1`, [id]).catch(() => undefined);
    }
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-18 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-18] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
