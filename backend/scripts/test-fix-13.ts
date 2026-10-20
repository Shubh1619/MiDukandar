/**
 * Regression test - fix-13: products had no expiry-date field, so "Add product"
 * could not record one. This verifies the new optional expiry_date column flows
 * through create -> read -> update -> clear.
 *
 * FAILS BEFORE the fix: POST /api/products ignored expiryDate (no column) and
 *   the read-back had no expiryDate, and PUT could not set or clear it.
 * PASSES AFTER: migration 021 + productSchema.expiryDate on create/update.
 *
 * Run:  npx tsx scripts/test-fix-13.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";
import crypto from "node:crypto";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

type InjectRes = { json: () => any; body: string; statusCode: number };
type App = {
  inject: (o: unknown) => Promise<InjectRes>;
  listen: (o: unknown) => Promise<unknown>;
  close: () => Promise<void>;
};

async function login(app: App, email: string) {
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
  return { token: body.accessToken, storeId: body.user?.storeId as string | undefined };
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false }) as unknown as App;
  await app.listen({ port: 0, host: "127.0.0.1" });

  const createdIds: string[] = [];
  const unique = Date.now();

  try {
    const auth = await login(app, "owner@midukandar.demo");
    const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };
    const expiry = "2027-05-31";

    // --- create with expiry -------------------------------------------------
    const createRes = await app.inject({
      method: "POST",
      url: "/api/products",
      headers,
      payload: { name: `fix13 product ${unique}`, sellingPrice: 10, expiryDate: expiry },
    });
    const created = (createRes.json() as { product?: { id?: string; expiryDate?: string | null } }).product;
    check(
      "fix-13 creating a product with an expiry date returns it (201)",
      createRes.statusCode === 201 && created?.expiryDate === expiry,
      `status=${createRes.statusCode} expiryDate=${created?.expiryDate}`,
    );
    if (created?.id) createdIds.push(created.id);

    // --- read back ----------------------------------------------------------
    if (created?.id) {
      const getRes = await app.inject({ method: "GET", url: `/api/products/${created.id}`, headers });
      const got = (getRes.json() as { product?: { expiryDate?: string | null } }).product;
      check(
        "fix-13 the expiry date persists on read",
        got?.expiryDate === expiry,
        `expiryDate=${got?.expiryDate}`,
      );
    }

    // --- update the expiry --------------------------------------------------
    if (created?.id) {
      const newExpiry = "2028-01-15";
      const putRes = await app.inject({
        method: "PUT",
        url: `/api/products/${created.id}`,
        headers,
        payload: { expiryDate: newExpiry },
      });
      const updated = (putRes.json() as { product?: { expiryDate?: string | null } }).product;
      check(
        "fix-13 the expiry date can be changed",
        putRes.statusCode === 200 && updated?.expiryDate === newExpiry,
        `status=${putRes.statusCode} expiryDate=${updated?.expiryDate}`,
      );
    }

    // --- expiry is optional: a product with none is fine --------------------
    const noExpRes = await app.inject({
      method: "POST",
      url: "/api/products",
      headers,
      payload: { name: `fix13 no-expiry ${unique}`, sellingPrice: 10 },
    });
    const noExp = (noExpRes.json() as { product?: { id?: string; expiryDate?: string | null } }).product;
    check(
      "fix-13 expiry is optional on create",
      noExpRes.statusCode === 201 && (noExp?.expiryDate == null),
      `status=${noExpRes.statusCode} expiryDate=${noExp?.expiryDate}`,
    );
    if (noExp?.id) createdIds.push(noExp.id);

    // --- clearing an expiry with an empty string nulls it -------------------
    if (created?.id) {
      const clearRes = await app.inject({
        method: "PUT",
        url: `/api/products/${created.id}`,
        headers,
        payload: { expiryDate: "" },
      });
      const cleared = (clearRes.json() as { product?: { expiryDate?: string | null } }).product;
      check(
        "fix-13 an empty expiry string clears the value",
        clearRes.statusCode === 200 && (cleared?.expiryDate == null),
        `status=${clearRes.statusCode} expiryDate=${cleared?.expiryDate}`,
      );
    }
  } finally {
    for (const id of createdIds) {
      await pool.query(`DELETE FROM products WHERE id = $1`, [id]).catch(() => undefined);
    }
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-13 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-13] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
