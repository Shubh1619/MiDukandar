/**
 * Regression test - fix-19: low-stock alert feed.
 *
 * The web dashboard popup / products banner and the mobile alert dialog read
 * GET /api/inventory/stock/low. This test locks in the contract they rely on:
 * { count, items:[{id,name,balance,minStock}] }, only products whose derived
 * balance is below min_stock (with min_stock > 0), and archived products
 * excluded.
 *
 * PASSES AFTER: the feed returns the below-minimum non-archived product and
 *   omits a healthy product and an archived low product.
 *
 * Run:  npx tsx scripts/test-fix-19.ts     (exit 0 = PASS, 1 = FAIL)
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

interface Item { id: string; name: string; balance: number; minStock: number }

async function main(): Promise<void> {
  await pool.query(`DELETE FROM otps`).catch(() => undefined);
  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false }) as unknown as App;
  await app.listen({ port: 0, host: "127.0.0.1" });

  const createdIds: string[] = [];
  let storeId = "";

  try {
    const auth = await login(app);
    storeId = auth.storeId;
    const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };

    const stamp = Date.now();
    const lowName = `fix19 low ${stamp}`;
    const healthyName = `fix19 healthy ${stamp}`;
    const archivedName = `fix19 archived ${stamp}`;

    // Insert products directly so we control min_stock + opening stock precisely.
    const mk = async (name: string, minStock: number, opening: number, archived = false) => {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO products (store_id, name, unit, selling_price, purchase_price, min_stock, is_archived)
         VALUES ($1, $2, 'Piece', 10, 5, $3, $4) RETURNING id`,
        [storeId, name, minStock, archived],
      );
      const id = res.rows[0].id;
      createdIds.push(id);
      if (opening > 0) {
        await pool.query(
          `INSERT INTO stock_movements (store_id, product_id, type, qty, reference_type, balance_after, note)
           VALUES ($1, $2, 'OPENING', $3, 'OPENING', $3, 'fix19 seed')`,
          [storeId, id, opening],
        );
      }
      return id;
    };

    const lowId = await mk(lowName, 10, 3);
    const healthyId = await mk(healthyName, 5, 50);
    const archivedId = await mk(archivedName, 10, 1, true);

    const res = await app.inject({ method: "GET", url: "/api/inventory/stock/low", headers });
    const body = res.json() as { count?: number; items?: Item[] };
    const items = body.items ?? [];
    const ids = new Set(items.map((i) => i.id));

    check("fix-19 GET /api/inventory/stock/low answers 200", res.statusCode === 200, `status=${res.statusCode}`);
    check("fix-19 returns an items array and count", Array.isArray(body.items) && typeof body.count === "number", `count=${body.count}`);
    check("fix-19 count matches items length", body.count === items.length, `count=${body.count} len=${items.length}`);

    const low = items.find((i) => i.id === lowId);
    check("fix-19 includes the below-minimum product", !!low, `idsPresent=${ids.has(lowId)}`);
    check(
      "fix-19 the low item carries balance and minStock",
      !!low && Number(low.balance) === 3 && Number(low.minStock) === 10,
      `balance=${low?.balance} minStock=${low?.minStock}`,
    );
    check("fix-19 excludes the healthy product", !ids.has(healthyId), `healthyPresent=${ids.has(healthyId)}`);
    check("fix-19 excludes the archived product", !ids.has(archivedId), `archivedPresent=${ids.has(archivedId)}`);
  } finally {
    for (const id of createdIds) {
      await pool.query(`DELETE FROM stock_movements WHERE product_id=$1`, [id]).catch(() => undefined);
      await pool.query(`DELETE FROM products WHERE id=$1`, [id]).catch(() => undefined);
    }
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-19 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-19] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
