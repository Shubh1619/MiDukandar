/**
 * Regression test — fix-12 (B11): the platform settings the superadmin console
 * writes were never consulted, so every toggle was cosmetic.
 *
 * FAILS BEFORE the fix: PATCH /api/superadmin/settings stored the rows but
 *   nothing read them — maintenance_mode did not block tenant traffic,
 *   signup_enabled did not stop /api/auth/register, smtp_paused had no effect on
 *   delivery and the OTP length/expiry defaults were ignored.
 * PASSES AFTER: src/lib/platform-settings.ts feeds the values into the tenant
 *   `authenticate` guard, the register route, sendMail and the OTP request.
 *
 * Run:  npx tsx scripts/test-fix-12.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { signSuperAdminToken } from "../src/lib/superadmin-jwt.js";
import { invalidatePlatformSettings } from "../src/lib/platform-settings.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

type App = {
  inject: (o: unknown) => Promise<{ json: () => any; body: string; statusCode: number }>;
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
  const body = res.json();
  if (!body.accessToken) throw new Error("login failed: " + res.body);
  return body.accessToken as string;
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false }) as unknown as App;
  await app.listen({ port: 0, host: "127.0.0.1" });

  const saEmail = `fix12-sa-${Date.now()}@midukandar.test`;
  const saPassword = "fix12-secret";
  let saId: string | null = null;

  const setSetting = async (key: string, value: unknown) => {
    await pool.query(
      `INSERT INTO platform_settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value)],
    );
    invalidatePlatformSettings();
  };
  const clearSetting = async (key: string) => {
    await pool.query(`DELETE FROM platform_settings WHERE key = $1`, [key]);
    invalidatePlatformSettings();
  };

  try {
    const hash = await bcrypt.hash(saPassword, 4);
    const row = await pool.query<{ id: string }>(
      `INSERT INTO super_admins (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [saEmail, "Fix12 SA", hash],
    );
    saId = row.rows[0]?.id ?? null;
    check("fixtures: superadmin created", !!saId, `id=${saId}`);

    const saToken = signSuperAdminToken({ sub: saId!, email: saEmail, name: "Fix12 SA" }, 600);
    const saHeaders = { authorization: `Bearer ${saToken}`, "content-type": "application/json" };
    const me = await app.inject({ method: "GET", url: "/api/superadmin/auth/me", headers: saHeaders });
    check("fixtures: superadmin token accepted", me.statusCode === 200, `status=${me.statusCode}`);

    const patch = await app.inject({
      method: "PATCH", url: "/api/superadmin/settings", headers: saHeaders,
      payload: { updates: { maintenance_mode: true, signup_enabled: false, smtp_paused: true, default_otp_length: 8, default_otp_expiry_minutes: 3 } },
    });
    check("fix-12 settings patch accepted", patch.statusCode === 200, `status=${patch.statusCode} body=${patch.body.slice(0, 160)}`);

    // --- signup gate -------------------------------------------------------
    const reg = await app.inject({
      method: "POST", url: "/api/auth/register",
      payload: {
        email: `fix12-new-${Date.now()}@midukandar.test`, ownerName: "New Owner", name: "New Store",
        type: "grocery", city: "Pune",
      },
    });
    check("fix-12 register is blocked while signup_enabled is false", reg.statusCode === 403, `status=${reg.statusCode} body=${reg.body.slice(0, 160)}`);

    // --- OTP policy --------------------------------------------------------
    const otpUser = `fix12-otp-${Date.now()}@midukandar.test`;
    await pool.query(`INSERT INTO users (email, name) VALUES ($1, $2)`, [otpUser, "otp user"]);
    const otpReq = await app.inject({ method: "POST", url: "/api/auth/otp/request", payload: { email: otpUser, purpose: "LOGIN" } });
    const otpBody = otpReq.json();
    check(
      "fix-12 OTP expiry reflects default_otp_expiry_minutes",
      otpReq.statusCode === 200 && otpBody.expiresInSeconds === 180,
      `expiresInSeconds=${otpBody.expiresInSeconds}`,
    );
    const otpRow = await pool.query<{ otp_hash: string }>(
      `SELECT otp_hash FROM otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, [otpUser.toLowerCase()],
    );
    check("fix-12 an OTP row was issued under the new policy", otpRow.rows.length === 1, `rows=${otpRow.rows.length}`);

    // --- maintenance gate --------------------------------------------------
    // A tenant (demo owner) call must now answer 503 with the maintenance code.
    const ownerToken = await login(app, "owner@midukandar.demo");
    const ownerHeaders = { authorization: `Bearer ${ownerToken}`, "content-type": "application/json" };
    const blocked = await app.inject({ method: "GET", url: "/api/products?limit=1", headers: ownerHeaders });
    check(
      "fix-12 tenant traffic is blocked in maintenance mode",
      blocked.statusCode === 503 && /maintenance/i.test(blocked.body),
      `status=${blocked.statusCode} body=${blocked.body.slice(0, 160)}`,
    );

    // Superadmin routes stay reachable so maintenance can be turned off.
    const stillUp = await app.inject({ method: "GET", url: "/api/superadmin/settings", headers: saHeaders });
    check("fix-12 superadmin can still reach settings during maintenance", stillUp.statusCode === 200, `status=${stillUp.statusCode}`);

    // --- turning maintenance off restores access ---------------------------
    await setSetting("maintenance_mode", false);
    const restored = await app.inject({ method: "GET", url: "/api/products?limit=1", headers: ownerHeaders });
    check("fix-12 tenant traffic resumes once maintenance is off", restored.statusCode === 200, `status=${restored.statusCode} body=${restored.body.slice(0, 120)}`);
  } finally {
    await clearSetting("maintenance_mode");
    await clearSetting("signup_enabled");
    await clearSetting("smtp_paused");
    await clearSetting("default_otp_length");
    await clearSetting("default_otp_expiry_minutes");
    if (saId) await pool.query(`DELETE FROM superadmin_audit_logs WHERE superadmin_id = $1`, [saId]).catch(() => undefined);
    if (saId) await pool.query(`DELETE FROM super_admins WHERE id = $1`, [saId]).catch(() => undefined);
    await pool.query(`DELETE FROM users WHERE email LIKE 'fix12-%'`).catch(() => undefined);
    await pool.query(`DELETE FROM otps WHERE email LIKE 'fix12-%'`).catch(() => undefined);
    await pool.query(`DELETE FROM stores WHERE name = 'New Store'`).catch(() => undefined);
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-12 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-12] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
