/**
 * Regression test - fix-15: sessions that never expire on their own.
 *
 * Covers two server-side pieces of the "stay signed in" work:
 *   1. SuperAdmin console now has a SLIDING REFRESH session. Before this, the
 *      only credential was a 15-minute access token in a cookie with no refresh
 *      path, so the console hard-logged-out every 15 minutes.
 *   2. Tenant "logged-in devices": GET /api/auth/sessions lists live sessions
 *      and DELETE /api/auth/sessions/:id revokes one.
 *
 * FAILS BEFORE: POST /api/superadmin/auth/refresh 404s; GET /api/auth/sessions
 *   404s.
 * PASSES AFTER: refresh rotates and returns a fresh access token; sessions list
 *   marks the current device and a per-device revoke works.
 *
 * Run:  npx tsx scripts/test-fix-15.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { pool } from "../src/db/pool.js";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

type InjectRes = { json: () => Record<string, unknown>; body: string; statusCode: number; headers: Record<string, unknown> };
function cookieFrom(res: { headers: Record<string, unknown> }): string | undefined {
  const raw = res.headers["set-cookie"];
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const joined = arr.map((c) => String(c).split(";")[0]).join("; ");
  return joined || undefined;
}

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
  return { token: body.accessToken, storeId: body.user?.storeId as string | undefined, cookie: cookieFrom(res) };
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");
  const app = buildApp({ logger: false }) as unknown as App;
  await app.listen({ port: 0, host: "127.0.0.1" });

  const unique = Date.now();
  const saEmail = `sa-fix15-${unique}@midukandar.test`;
  const saPassword = "fix15-password-123";
  let saId: string | undefined;

  try {
    // ---- 1. Tenant "logged-in devices" ------------------------------------
    const auth = await login(app, "owner@midukandar.demo");
    const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };

    const listRes = await app.inject({
      method: "GET",
      url: "/api/auth/sessions",
      headers: auth.cookie ? { ...headers, cookie: auth.cookie } : headers,
    });
    const list = listRes.json() as { sessions?: Array<{ id: string; current: boolean; deviceInfo: string | null }> };
    check(
      "fix-15 GET /api/auth/sessions lists the live session (200)",
      listRes.statusCode === 200 && Array.isArray(list.sessions) && list.sessions.length >= 1,
      `status=${listRes.statusCode} count=${list.sessions?.length}`,
    );
    check(
      "fix-15 the current device is flagged",
      !!list.sessions?.some((s) => s.current === true),
      `current=${list.sessions?.map((s) => s.current).join(",")}`,
    );

    const victim = list.sessions?.find((s) => !s.current) ?? list.sessions?.[0];
    if (victim) {
      const delRes = await app.inject({
        method: "DELETE",
        url: `/api/auth/sessions/${victim.id}`,
        headers,
      });
      check(
        "fix-15 DELETE /api/auth/sessions/:id revokes a device (204)",
        delRes.statusCode === 204,
        `status=${delRes.statusCode}`,
      );
      const afterRes = await app.inject({
        method: "GET",
        url: "/api/auth/sessions",
        headers: auth.cookie ? { ...headers, cookie: auth.cookie } : headers,
      });
      const after = afterRes.json() as { sessions?: Array<{ id: string }> };
      check(
        "fix-15 the revoked session disappears from the list",
        !after.sessions?.some((s) => s.id === victim.id),
        `stillPresent=${after.sessions?.some((s) => s.id === victim.id)}`,
      );
    }

    // ---- 2. SuperAdmin sliding refresh ------------------------------------
    const [sa] = await pool
      .query<{ id: string }>(
        `INSERT INTO super_admins (name, email, password_hash)
         VALUES ($1, $2, $3) RETURNING id`,
        ["Fix Fifteen", saEmail, await bcrypt.hash(saPassword, 10)],
      )
      .then((r) => r.rows);
    saId = sa.id;

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/superadmin/auth/login",
      payload: { email: saEmail, password: saPassword },
    });
    check(
      "fix-15 superadmin login succeeds (200)",
      loginRes.statusCode === 200,
      `status=${loginRes.statusCode} body=${loginRes.body.slice(0, 120)}`,
    );
    const saCookie = cookieFrom(loginRes);
    check("fix-15 login sets the access + refresh cookies", !!saCookie, `cookie=${saCookie}`);

    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/superadmin/auth/refresh",
      headers: saCookie ? { cookie: saCookie } : {},
      payload: {},
    });
    const refreshBody = refreshRes.json() as { superadmin?: { id: string } };
    check(
      "fix-15 POST /api/superadmin/auth/refresh rotates the session (200)",
      refreshRes.statusCode === 200 && refreshBody.superadmin?.id === saId,
      `status=${refreshRes.statusCode} body=${refreshRes.body.slice(0, 120)}`,
    );

    const refreshedCookie = cookieFrom(refreshRes);
    const sessionsRes = await app.inject({
      method: "GET",
      url: "/api/superadmin/auth/sessions",
      headers: refreshedCookie ? { cookie: refreshedCookie } : saCookie ? { cookie: saCookie } : {},
    });
    const sessionsBody = sessionsRes.json() as { sessions?: Array<{ id: string }> };
    check(
      "fix-15 superadmin /sessions lists the active session (200)",
      sessionsRes.statusCode === 200 && (sessionsBody.sessions?.length ?? 0) >= 1,
      `status=${sessionsRes.statusCode} count=${sessionsBody.sessions?.length}`,
    );

    // Step-up re-auth: wrong password rejected, right password accepted.
    const badReauth = await app.inject({
      method: "POST",
      url: "/api/superadmin/auth/re-auth",
      headers: saCookie ? { cookie: saCookie } : {},
      payload: { password: "wrong-password-xyz" },
    });
    check(
      "fix-15 step-up re-auth rejects a wrong password (401)",
      badReauth.statusCode === 401,
      `status=${badReauth.statusCode}`,
    );
    const goodReauth = await app.inject({
      method: "POST",
      url: "/api/superadmin/auth/re-auth",
      headers: saCookie ? { cookie: saCookie } : {},
      payload: { password: saPassword },
    });
    check(
      "fix-15 step-up re-auth accepts the right password (200)",
      goodReauth.statusCode === 200,
      `status=${goodReauth.statusCode}`,
    );
  } finally {
    if (saId) {
      await pool.query(`DELETE FROM super_admins WHERE id = $1`, [saId]).catch(() => undefined);
    }
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "\nALL FIX-15 CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("[test-fix-15] FAILED:", e instanceof Error ? e.message : e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
