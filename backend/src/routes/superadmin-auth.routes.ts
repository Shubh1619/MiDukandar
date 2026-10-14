import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { signSuperAdminToken, parseDurationSeconds } from "../lib/superadmin-jwt.js";
import { logSuperadminAction } from "../lib/superadmin-audit.js";
import { requireSuperAdmin, getSuperadmin } from "../middlewares/superadmin.js";
import { rateLimitKey } from "../lib/rate-limit-key.js";
import { qOne, qExec } from "../db/pool.js";

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

const SA_COOKIE = config.superAdminCookieName;

const saCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  // Reuses the deployment-wide HTTPS flag (already fail-fast validated for the
  // refresh cookie) rather than adding a second knob that can be misconfigured.
  secure: config.refreshCookieSecure,
  path: "/",
  maxAge: maxAgeSeconds,
});

export async function superadminAuthRoutes(app: FastifyInstance) {
  // Stricter than tenant login (which is bounded by OTP request throttling):
  // 10 credential attempts per minute across the whole superadmin auth scope.
  app.register(import("@fastify/rate-limit"), {
    max: 10,
    timeWindow: 60_000,
    // Same socket-anchored keying as the global limiter: this nested
    // registration is its own plugin instance and does not inherit the root
    // keyGenerator. Without it, credential stuffing against this 10/min limit
    // could rotate X-Forwarded-For for a fresh bucket every attempt.
    keyGenerator: rateLimitKey,
  });

  app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parse(loginSchema, request.body);
    const email = body.email.trim().toLowerCase();

    const row = await qOne<SuperAdminRow>(
      `SELECT id, name, email, password_hash, created_at FROM super_admins WHERE email = $1`,
      [email],
    );
    // Async (promise) form: bcryptjs is pure JS, so the sync variant blocks the
    // single event-loop thread for the whole hash/compare.
    const passwordOk = row ? await bcrypt.compare(body.password, row.passwordHash) : false;
    if (!row || !passwordOk) {
      await maybeAuditFailedLogin(email);
      throw ApiError.unauthorized("Invalid superadmin credentials.");
    }

    const expiresInSeconds = parseDurationSeconds(config.superAdminAccessExpiresIn);
    const accessToken = signSuperAdminToken(
      { sub: row.id, email: row.email, name: row.name },
      expiresInSeconds,
    );

    // Audit the login as the now-authenticated actor.
    request.superadmin = { id: row.id, email: row.email, name: row.name };
    await logSuperadminAction(request, "SUPERADMIN_LOGIN", { reason: "Superadmin sign in" });

    // The signed token is delivered ONLY as an httpOnly cookie. It is
    // deliberately absent from the response body so that neither `localStorage`
    // nor any XSS payload can read it; the web console authenticates every
    // request from the cookie alone. maxAge matches the token's own `exp`, so
    // the browser drops the cookie at exactly the moment the token expires.
    reply.setCookie(SA_COOKIE, accessToken, saCookieOptions(expiresInSeconds));

    return {
      expiresInSeconds,
      superadmin: { id: row.id, email: row.email, name: row.name },
    };
  });

  // Needed because an httpOnly cookie cannot be removed by client JavaScript:
  // without this endpoint "Sign out" would leave a fully valid session behind.
  app.post("/logout", async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie(SA_COOKIE, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: requireSuperAdmin }, async (request: FastifyRequest) => {
    return { superadmin: getSuperadmin(request) };
  });
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