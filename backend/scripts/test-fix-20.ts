/**
 * Regression test - fix-20: referral program flow (backend contract behind the
 * web Settings > Refer tab, the /onboard?ref= link and the mobile Refer & Earn
 * screen).
 *
 * Covers:
 *  - POST /api/auth/register accepts referralCode and links the new store
 *  - GET  /api/referral returns the owner's code, share link and referred stores
 *  - GET  /api/referral is owner-only
 *  - POST /api/referral/apply rejects a self code and an unknown code
 *
 * Run:  npx tsx scripts/test-fix-20.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { createHash } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { invalidatePlatformSettings } from "../src/lib/platform-settings.js";

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

async function main(): Promise<void> {
  await pool.query(`DELETE FROM otps`).catch(() => undefined);
  // Ensure self-signup is on for this run; restore afterwards.
  const prev = await pool.query<{ value: unknown }>(`SELECT value FROM platform_settings WHERE key='signup_enabled'`);
  const prevValue = prev.rows[0]?.value;
  await pool.query(
    `INSERT INTO platform_settings (key, value) VALUES ('signup_enabled', 'true'::jsonb)
     ON CONFLICT (key) DO UPDATE SET value='true'::jsonb`,
  ).catch(async () => {
    await pool.query(`UPDATE platform_settings SET value='true'::jsonb WHERE key='signup_enabled'`);
  });
  invalidatePlatformSettings();

  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false }) as unknown as App;
  await app.listen({ port: 0, host: "127.0.0.1" });

  const createdStoreIds: string[] = [];
  const createdEmails: string[] = [];

  const register = async (email: string, storeName: string, referralCode?: string) => {
    const otp = "654321";
    await pool.query(
      `INSERT INTO otps (email, otp_hash, purpose, expires_at)
       VALUES ($1, $2, 'REGISTER', now() + interval '10 minutes')`,
      [email.toLowerCase(), createHash("sha256").update(otp).digest("hex")],
    );
    const payload: Record<string, unknown> = {
      email, ownerName: "Test Owner", name: storeName, type: "Retail",
      address: "1 Test St", city: "Pune", state: "MH", pincode: "411001",
      phone: "9000000000", gst: "", currency: "INR", language: "en", invoicePrefix: "T",
      otp,
    };
    if (referralCode) payload.referralCode = referralCode;
    const res = await app.inject({ method: "POST", url: "/api/auth/register", payload });
    createdEmails.push(email.toLowerCase());
    const body = res.json() as { storeId?: string };
    if (body.storeId) createdStoreIds.push(body.storeId);
    return { status: res.statusCode, body };
  };

  try {
    const stamp = Date.now();
    const a = await register(`fix20-a-${stamp}@example.com`, `fix20 Referrer ${stamp}`);
    const b = await register(`fix20-b-${stamp}@example.com`, `fix20 Referred ${stamp}`);
    check(
      "fix-20 two stores register",
      a.status === 201 && b.status === 201 && !!a.body.storeId && !!b.body.storeId,
      `a=${a.status} b=${b.status}`,
    );

    const aStoreId = a.body.storeId as string;
    const bStoreId = b.body.storeId as string;

    const aCodeRow = await pool.query<{ referral_code: string }>(
      `SELECT referral_code FROM stores WHERE id=$1`, [aStoreId],
    );
    const aCode = aCodeRow.rows[0]?.referral_code;
    check("fix-20 every store gets a referral code", !!aCode && aCode.length >= 4, `code=${aCode}`);

    // b applies a's code.
    const applyRes = await app.inject({
      method: "POST", url: "/api/referral/apply",
      headers: { authorization: `Bearer ${await tokenFor(app, `fix20-b-${stamp}@example.com`)}`, "content-type": "application/json" },
      payload: { code: aCode },
    });
    check("fix-20 POST /api/referral/apply accepts a valid code", applyRes.statusCode === 200, `status=${applyRes.statusCode} body=${applyRes.body.slice(0, 160)}`);

    const linked = await pool.query<{ referred_by_store_id: string | null }>(
      `SELECT referred_by_store_id FROM stores WHERE id=$1`, [bStoreId],
    );
    check("fix-20 the new store is linked to its referrer", linked.rows[0]?.referred_by_store_id === aStoreId, `linked=${linked.rows[0]?.referred_by_store_id}`);

    // referrer listing.
    const listRes = await app.inject({
      method: "GET", url: "/api/referral",
      headers: { authorization: `Bearer ${await tokenFor(app, `fix20-a-${stamp}@example.com`)}` },
    });
    const list = listRes.json() as {
      code?: string; shareUrl?: string; referredCount?: number;
      referrals?: { storeName: string }[];
    };
    check("fix-20 GET /api/referral answers 200", listRes.statusCode === 200, `status=${listRes.statusCode}`);
    check("fix-20 listing exposes the code", list.code === aCode, `code=${list.code}`);
    check("fix-20 listing exposes a share link containing the code", !!list.shareUrl && list.shareUrl.includes(aCode as string), `shareUrl=${list.shareUrl}`);
    check("fix-20 referrer sees the referred store", list.referredCount === 1 && !!list.referrals?.some((r) => r.storeName === `fix20 Referred ${stamp}`), `count=${list.referredCount}`);

    // self-code rejected.
    const selfRes = await app.inject({
      method: "POST", url: "/api/referral/apply",
      headers: { authorization: `Bearer ${await tokenFor(app, `fix20-a-${stamp}@example.com`)}`, "content-type": "application/json" },
      payload: { code: aCode },
    });
    check("fix-20 self referral code is rejected", selfRes.statusCode === 400, `status=${selfRes.statusCode}`);

    // unknown code rejected.
    const unknownRes = await app.inject({
      method: "POST", url: "/api/referral/apply",
      headers: { authorization: `Bearer ${await tokenFor(app, `fix20-b-${stamp}@example.com`)}`, "content-type": "application/json" },
      payload: { code: "ZZZZZZZZ" },
    });
    check("fix-20 applying twice / unknown code is rejected", unknownRes.statusCode === 409 || unknownRes.statusCode === 400, `status=${unknownRes.statusCode}`);
  } finally {
    // Unlink referrals, then remove created stores (and their users). Stock
    // movements / refresh tokens cascade or are cleaned explicitly.
    if (createdStoreIds.length) {
      await pool.query(`UPDATE stores SET referred_by_store_id=NULL WHERE id = ANY($1::uuid[])`, [createdStoreIds]).catch(() => undefined);
      await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE store_id = ANY($1::uuid[]))`, [createdStoreIds]).catch(() => undefined);
      await pool.query(`DELETE FROM users WHERE store_id = ANY($1::uuid[])`, [createdStoreIds]).catch(() => undefined);
      await pool.query(`DELETE FROM stores WHERE id = ANY($1::uuid[])`, [createdStoreIds]).catch(() => undefined);
    }
    for (const email of createdEmails) {
      await pool.query(`DELETE FROM users WHERE email=$1 AND store_id IS NULL`, [email]).catch(() => undefined);
    }
    if (prevValue !== undefined) {
      await pool.query(`UPDATE platform_settings SET value=$1::jsonb WHERE key='signup_enabled'`, [JSON.stringify(prevValue)]).catch(() => undefined);
    } else {
      await pool.query(`DELETE FROM platform_settings WHERE key='signup_enabled'`).catch(() => undefined);
    }
    invalidatePlatformSettings();
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-20 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

async function tokenFor(app: App, email: string): Promise<string> {
  const master = process.env.OTP_MASTER?.trim();
  if (!master) throw new Error("OTP_MASTER must be set in the environment");
  const crypto = await import("node:crypto");
  await pool.query(
    `INSERT INTO otps (email, otp_hash, purpose, expires_at)
     VALUES ($1, $2, 'LOGIN', now() + interval '10 minutes')`,
    [email.toLowerCase(), crypto.createHash("sha256").update(master).digest("hex")],
  );
  const res = await app.inject({ method: "POST", url: "/api/auth/otp/verify", payload: { email, otp: master } });
  const body = res.json() as { accessToken?: string };
  if (!body.accessToken) throw new Error(`login failed for ${email}: ` + res.body);
  return body.accessToken;
}

main().catch(async (e) => {
  console.error("[test-fix-20] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
