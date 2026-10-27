import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { signSuperAdminToken, parseDurationSeconds } from "../lib/superadmin-jwt.js";
import { logSuperadminAction } from "../lib/superadmin-audit.js";
import { requireSuperAdmin, getSuperadmin } from "../middlewares/superadmin.js";
import { rateLimitKey } from "../lib/rate-limit-key.js";
import { rateLimited } from "../lib/route-rate-limit.js";
import { q, qOne, qExec, withTx } from "../db/pool.js";

interface SuperAdminRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const reAuthSchema = z.object({
  password: z.string().min(8).max(200),
});

const SA_COOKIE = config.superAdminCookieName;
const SA_REFRESH_COOKIE = config.superAdminRefreshCookieName;

// Never expire superadmin sessions
const REFRESH_DAYS_MS = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years
// Window during which a just-rotated (revoked) refresh token is still
// accepted, so concurrent console tabs refresh-rotating at the same time do
// not log each other out. Explicit logout does NOT set a grace window.
const REFRESH_GRACE_MS = 60_000;

const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex");
const issueRefreshToken = () => randomBytes(48).toString("base64url");

function deviceInfo(request: FastifyRequest): string {
  const ua = String(request.headers["user-agent"] ?? "").trim();
  return `ip=${request.ip}${ua ? ` ua=${ua.slice(0, 300)}` : ""}`;
}

const saCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.refreshCookieSecure,
  path: "/",
  maxAge: maxAgeSeconds,
});

function setSaCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  const accessSeconds = parseDurationSeconds(config.superAdminAccessExpiresIn);
  reply.setCookie(SA_COOKIE, accessToken, saCookieOptions(accessSeconds));
  reply.setCookie(
    SA_REFRESH_COOKIE,
    refreshToken,
    saCookieOptions(100 * 365 * 86400),
  );
}

async function createRefreshToken(superadminId: string, device: string, now = Date.now()) {
  const token = issueRefreshToken();
  await qExec(
    `INSERT INTO superadmin_refresh_tokens (superadmin_id, token_hash, device_info, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [superadminId, hashRefreshToken(token), device, new Date(now + REFRESH_DAYS_MS)],
  );
  return token;
}

function issueAccessToken(row: { id: string; email: string; name: string }) {
  const expiresInSeconds = parseDurationSeconds(config.superAdminAccessExpiresIn);
  return {
    accessToken: signSuperAdminToken({ sub: row.id, email: row.email, name: row.name }, expiresInSeconds),
    expiresInSeconds,
  };
}

export async function superadminAuthRoutes(app: FastifyInstance) {
  // Stricter than tenant login (which is bounded by OTP request throttling):
  // 10 credential attempts per minute across the whole superadmin auth scope.
  app.register(import("@fastify/rate-limit"), {
    max: 10,
    timeWindow: 60_000,
    keyGenerator: rateLimitKey,
  });

  app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parse(loginSchema, request.body);
    const email = body.email.trim().toLowerCase();

    const row = await qOne<SuperAdminRow>(
      `SELECT id, name, email, password_hash, created_at FROM super_admins WHERE email = $1`,
      [email],
    );
    const passwordOk = row ? await bcrypt.compare(body.password, row.passwordHash) : false;
    if (!row || !passwordOk) {
      await maybeAuditFailedLogin(email);
      throw ApiError.unauthorized("Invalid superadmin credentials.");
    }

    const { accessToken, expiresInSeconds } = issueAccessToken(row);
    const refreshToken = await createRefreshToken(row.id, deviceInfo(request));

    // Audit the login as the now-authenticated actor.
    request.superadmin = { id: row.id, email: row.email, name: row.name };
    await logSuperadminAction(request, "SUPERADMIN_LOGIN", { reason: "Superadmin sign in" });

    // The access token is delivered ONLY as an httpOnly cookie (never in the
    // body), and a sliding refresh cookie is set alongside it so the console
    // can silently refresh the short-lived access token instead of logging the
    // operator out every 15 minutes.
    setSaCookies(reply, accessToken, refreshToken);

    return {
      expiresInSeconds,
      superadmin: { id: row.id, email: row.email, name: row.name },
    };
  });

  // Exchange the sliding refresh cookie for a fresh access token. Single
  // rotation + grace, mirroring the tenant endpoint.
  app.post("/refresh", rateLimited(60, 60_000), async (request: FastifyRequest, reply: FastifyReply) => {
    const cookieToken = request.cookies?.[SA_REFRESH_COOKIE];
    const body = (request.body ?? {}) as { refreshToken?: string };
    const raw = body.refreshToken || cookieToken;

    const clearCookies = () => {
      reply.clearCookie(SA_COOKIE, { path: "/" });
      reply.clearCookie(SA_REFRESH_COOKIE, { path: "/" });
    };

    if (!raw) {
      clearCookies();
      throw ApiError.unauthorized("Session expired. Please sign in again.");
    }

    const stored = await qOne<{
      id: string;
      superadmin_id: string;
      revoked: boolean;
      grace_until: Date | null;
      expires_at: Date;
    }>(`SELECT id, superadmin_id, revoked, grace_until, expires_at FROM superadmin_refresh_tokens WHERE token_hash = $1`, [
      hashRefreshToken(raw),
    ]);

    const rejected = () => {
      clearCookies();
      throw ApiError.unauthorized("Session expired. Please sign in again.");
    };

    if (!stored) return rejected();
    if (stored.revoked) {
      const graceMs = stored.grace_until ? new Date(stored.grace_until).getTime() : 0;
      if (graceMs <= Date.now()) return rejected();
    }
    // Never expire refresh tokens
    // if (new Date(stored.expires_at) < new Date()) return rejected();

    const admin = await qOne<{ id: string; name: string; email: string }>(
      `SELECT id, name, email FROM super_admins WHERE id = $1`,
      [stored.superadmin_id],
    );
    if (!admin) return rejected();

    const { accessToken, expiresInSeconds } = issueAccessToken(admin);

    const newRefresh = await withTx(async (db) => {
      await db.query(
        `UPDATE superadmin_refresh_tokens
            SET revoked = TRUE,
                grace_until = now() + (GREATEST(0, $2) || ' milliseconds')::interval,
                last_used_at = COALESCE(last_used_at, now())
          WHERE id = $1 AND revoked = FALSE`,
        [stored.id, REFRESH_GRACE_MS],
      );
      const token = issueRefreshToken();
      await db.query(
        `INSERT INTO superadmin_refresh_tokens (superadmin_id, token_hash, device_info, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [admin.id, hashRefreshToken(token), deviceInfo(request), new Date(Date.now() + REFRESH_DAYS_MS)],
      );
      return token;
    });

    setSaCookies(reply, accessToken, newRefresh);
    return { expiresInSeconds, superadmin: admin };
  });

  // Step-up re-authentication: sensitive superadmin actions require the
  // operator to re-enter their password even though the session is valid. The
  // check runs server-side against the bcrypt hash and is audited.
  app.post("/re-auth", { preHandler: requireSuperAdmin }, async (request: FastifyRequest) => {
    const sa = getSuperadmin(request);
    const { password } = parse(reAuthSchema, request.body);
    const row = await qOne<SuperAdminRow>(
      `SELECT id, name, email, password_hash, created_at FROM super_admins WHERE id = $1`,
      [sa.id],
    );
    const ok = row ? await bcrypt.compare(password, row.passwordHash) : false;
    if (!ok) {
      await logSuperadminAction(request, "SUPERADMIN_REAUTH_FAILED", { reason: "Invalid password" });
      throw ApiError.unauthorized("Incorrect password.");
    }
    await logSuperadminAction(request, "SUPERADMIN_REAUTH", { reason: "Step-up re-authentication" });
    return { ok: true, verifiedAt: new Date().toISOString() };
  });

  // Needed because an httpOnly cookie cannot be removed by client JavaScript:
  // without this endpoint "Sign out" would leave a fully valid session behind.
  app.post("/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    const cookieToken = request.cookies?.[SA_REFRESH_COOKIE];
    const body = (request.body ?? {}) as { refreshToken?: string };
    const candidates = [cookieToken, body.refreshToken].filter((t): t is string => Boolean(t));
    for (const rawToken of candidates) {
      await qExec(`UPDATE superadmin_refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [
        hashRefreshToken(rawToken),
      ]);
    }
    reply.clearCookie(SA_COOKIE, { path: "/" });
    reply.clearCookie(SA_REFRESH_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireSuperAdmin }, async (request: FastifyRequest) => {
    return { superadmin: getSuperadmin(request) };
  });

  // Active superadmin sessions ("logged-in devices"), newest first. Only
  // non-revoked, non-expired tokens are listed.
  app.get("/sessions", { preHandler: requireSuperAdmin }, async (request: FastifyRequest) => {
    const sa = getSuperadmin(request);
    const rows = await q<Record<string, unknown>>(
      `SELECT id, device_info, created_at, last_used_at, expires_at
         FROM superadmin_refresh_tokens
        WHERE superadmin_id = $1 AND revoked = FALSE AND expires_at > now()
        ORDER BY COALESCE(last_used_at, created_at) DESC
        LIMIT 50`,
      [sa.id],
    );
    return { sessions: rows };
  });

  // Revoke a single superadmin session by id (e.g. "sign out that device").
  app.delete("/sessions/:id", { preHandler: requireSuperAdmin }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sa = getSuperadmin(request);
    const { id } = request.params as { id: string };
    const row = await qOne<{ id: string }>(
      `SELECT id FROM superadmin_refresh_tokens WHERE id = $1 AND superadmin_id = $2`,
      [id, sa.id],
    );
    if (!row) throw ApiError.notFound("Session not found.");
    await qExec(`UPDATE superadmin_refresh_tokens SET revoked = TRUE WHERE id = $1`, [id]);
    await logSuperadminAction(request, "SUPERADMIN_SESSION_REVOKED", { reason: "Revoked a device session" });
    return reply.code(204).send();
  });
}

async function qExecRows<T = Record<string, unknown>>(text: string, params: unknown[]): Promise<T[]> {
  const { q } = await import("../db/pool.js");
  return q<T>(text, params);
}

async function maybeAuditFailedLogin(email: string, reason = "INVALID_CREDENTIALS") {
  try {
    const row = await qOne<{ id: string }>(`SELECT id FROM super_admins WHERE email = $1`, [email]);
    if (row) {
      await qExec(
        `INSERT INTO superadmin_audit_logs (superadmin_id, action, reason, ip_address)
         VALUES ($1, 'SUPERADMIN_LOGIN_FAILED', $2, null)`,
        [row.id, reason],
      );
    }
  } catch {
    // Audit failures must never block login attempts.
  }
}
