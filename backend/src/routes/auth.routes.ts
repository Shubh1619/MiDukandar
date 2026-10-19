import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { q, qOne, qExec, withTx, type Row } from "../db/pool.js";
import { config } from "../config.js";
import { requestOtp, verifyOtp } from "../lib/otp.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { authenticate, getAuth, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { type DbUser, type Role } from "../middlewares/auth.types.js";
import { defaultPermissionsFor } from "./role.routes.js";
import { resolveReferralCode } from "./referral.routes.js";
import { getPlanForBusiness } from "../lib/plans.js";
import { rateLimited } from "../lib/route-rate-limit.js";

const REFRESH_DAYS_MS = config.refreshTokenDays * 24 * 60 * 60 * 1000;
// Window during which a just-rotated (revoked) refresh token is still
// accepted, so concurrent refreshes from multiple tabs — or a mobile retry
// after a timed-out first attempt — rotate again instead of being rejected.
// Explicit logouts and the recovery/PIN-reset revocation do NOT set a grace
// window, so they stay immediate.
const REFRESH_GRACE_MS = 60_000;
const COOKIE = config.refreshCookieName;

// ---------------------------------------------------------------------------
// Refresh-token helpers (hash-only storage; cookie transport; sliding expiry)
// ---------------------------------------------------------------------------

const hashRefreshToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const issueRefreshToken = () => randomBytes(48).toString("base64url");

const refreshCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: config.refreshCookieSecure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(COOKIE, token, refreshCookieOptions(config.refreshTokenDays * 86400));
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: "/" });
}

function deviceInfo(request: FastifyRequest): string {
  const ua = String(request.headers["user-agent"] ?? "").trim();
  return `ip=${request.ip}${ua ? ` ua=${ua.slice(0, 300)}` : ""}`;
}

async function createRefreshToken(userId: string, device: string, now = Date.now()) {
  const token = issueRefreshToken();
  await qExec(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashRefreshToken(token), device, new Date(now + REFRESH_DAYS_MS)],
  );
  return token;
}

const toPayload = (u: Row) => ({
  sub: u.id as string,
  id: u.id as string,
  email: u.email as string,
  role: (u.role as Role) ?? "OWNER",
  businessId: (u.store_id as string) ?? null,
  storeId: (u.store_id as string) ?? null,
  name: (u.name as string) ?? null,
});

const toUserJson = (u: Row) => ({
  id: u.id as string,
  email: u.email as string,
  role: (u.role as Role) ?? "OWNER",
  storeId: (u.store_id as string) ?? null,
  name: (u.name as string) ?? null,
});

export async function authRoutes(app: FastifyInstance) {
  const purposeSchema = z.enum(["LOGIN", "REGISTER"]).optional().default("LOGIN");
  const requestOtpSchema = z.object({ email: z.string().email(), purpose: purposeSchema });
  const verifyOtpSchema = z.object({ email: z.string().email(), otp: z.string().min(4).max(8), purpose: purposeSchema });
  const refreshSchema = z.object({ refreshToken: z.string().min(10).optional() });
  const loginKindSchema = z.object({ identifier: z.string().min(3).max(320) });

  // Tells the unified login page which flow to use after the user types an
  // identifier: platform superadmins sign in with email+password, everyone
  // else continues with the OTP flow. It answers "superadmin" or "tenant", so
  // an unauthenticated caller can enumerate which addresses are platform
  // admins; 30 probes per minute per IP keeps that useless without slowing a
  // real user down.
  app.post("/login-kind", rateLimited(30, 60_000), async (request) => {
    const { identifier } = parse(loginKindSchema, request.body);
    const value = identifier.trim().toLowerCase();
    if (value.includes("@")) {
      const sa = await qOne<Row>(`SELECT id FROM super_admins WHERE email = $1`, [value]);
      if (sa) return { kind: "superadmin" };
    }
    return { kind: "tenant" };
  });

  // Step 1 - request OTP. lib/otp.ts already caps deliveries per email (3 per
  // 10 minutes); this per-IP cap is the second layer, stopping an attacker who
  // rotates through many victim addresses from burning sender quota.
  app.post("/otp/request", rateLimited(10, 600_000), async (request, reply) => {
    const { email, purpose } = parse(requestOtpSchema, request.body);
    if (purpose === "LOGIN") {
      const existing = await qOne<Row>(`SELECT id FROM users WHERE email = $1`, [email.trim().toLowerCase()]);
      if (!existing) {
        throw ApiError.notFoundCode("We couldn't find a MiDukandar account for this email.", "ACCOUNT_NOT_FOUND");
      }
    }
    const result = await requestOtp(email, purpose);
    return reply.send(result);
  });

  // Step 2 - verify OTP → issue access token (body) + refresh token (httpOnly cookie).
  // A code is limited to 5 guesses per issuance inside lib/otp.ts; this per-IP
  // limit stops spraying the same short code across many emails from one host.
  app.post("/otp/verify", rateLimited(15, 600_000), async (request, reply) => {
    const { email, otp, purpose } = parse(verifyOtpSchema, request.body);
    await verifyOtp(email, otp, purpose);

    const normalized = email.trim().toLowerCase();
    let user = await qOne<Row>(`SELECT * FROM users WHERE email = $1`, [normalized]);
    if (!user) {
      const [created] = await q<Row>(
        `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *`,
        [normalized, normalized.split("@")[0]],
      );
      user = created;
      logger.info("auth: new user registered via OTP", { email: normalized });
    }
    if (!user.is_active) throw ApiError.forbidden("Account is inactive.");

    await qExec(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id as string]);

    const accessToken = app.jwt.sign(toPayload(user), { expiresIn: config.jwtAccessExpiresIn });
    const refreshToken = await createRefreshToken(user.id as string, deviceInfo(request));

    setRefreshCookie(reply, refreshToken);
    return reply.send({
      accessToken,
      expiresInSeconds: 15 * 60,
      user: toUserJson(user),
    });
  });

  // Registration - creates the account + store together, no OTP required.
  // No verification stands between a caller and a new store, so this is the
  // cheapest way to mass-create tenants and referral-credit fraud; 10 per hour
  // per IP still clears an office or a shared NAT signing up several people.
  app.post("/register", rateLimited(10, 3_600_000), async (request, reply) => {
    const registerSchema = z.object({
      email: z.string().email(),
      ownerName: z.string().min(2).max(80),
      name: z.string().min(2).max(120),
      type: z.string().min(1).max(60),
      address: z.string().max(300).optional().default(""),
      city: z.string().max(60).optional().default(""),
      state: z.string().max(60).optional().default(""),
      pincode: z.string().max(10).optional().default(""),
      phone: z.string().max(15).optional().default(""),
      gst: z.string().max(25).optional().default(""),
      currency: z.string().max(8).optional().default("INR"),
      language: z.string().max(8).optional().default("hi"),
      invoicePrefix: z.string().max(10).optional().default("INV"),
      referralCode: z.string().min(4).max(32).optional(),
    });
    const body = parse(registerSchema, request.body);
    const email = body.email.trim().toLowerCase();

    const existing = await qOne<Row>(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing) {
      throw ApiError.conflict("An account with this email already exists. Sign in instead.");
    }

    const referrerId = await resolveReferralCode(body.referralCode);

    const { store } = await withTx(async (db) => {
      const [user] = await db.q<Row>(
        `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *`,
        [email, body.ownerName.trim()],
      );
      const [store] = await db.q<Row>(
        `INSERT INTO stores
           (name, type, address, city, state, pincode, phone, gst, currency, language, invoice_prefix,
            referred_by_store_id, plan_id, plan_status, trial_ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 (SELECT id FROM plans WHERE is_default = TRUE AND status = 'ACTIVE' LIMIT 1),
                 'TRIAL',
                 (SELECT CASE WHEN trial_days > 0 THEN now() + trial_days * interval '1 day' END
                    FROM plans WHERE is_default = TRUE AND status = 'ACTIVE' LIMIT 1))
         RETURNING *`,
        [
          body.name, body.type, body.address, body.city, body.state, body.pincode, body.phone,
          body.gst || null, body.currency, body.language, body.invoicePrefix, referrerId,
        ],
      );
      await db.query(`UPDATE users SET store_id = $1, role = 'OWNER' WHERE id = $2`, [store.id, user.id]);
      return { user, store };
    });

    logger.info("auth: registration complete", { email, storeId: store.id });
    return reply.status(201).send({ ok: true, email, storeId: store.id });
  });

  // Step 3 - refresh token rotation + sliding expiry. Tokens are 48 random
  // bytes, so guessing is hopeless, but the endpoint is unauthenticated and a
  // tight per-IP cap also bounds how fast a stolen token can be replayed from
  // another host before it is rotated away. 60/minute covers several devices
  // refreshing on the same network.
  app.post("/refresh", rateLimited(60, 60_000), async (request, reply) => {
    const cookieToken = request.cookies?.[COOKIE];
    const { refreshToken: bodyToken } = parse(refreshSchema, request.body ?? {});
    const raw = bodyToken ?? cookieToken;

    if (!raw) {
      logger.warn("auth: refresh rejected - no refresh token provided", { ip: request.ip });
      throw ApiError.unauthorized("Session expired. Please sign in again.");
    }

    const tokenHash = hashRefreshToken(raw);
    const stored = await qOne<Row>(`SELECT * FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
    const rejected = (reason: string) => {
      logger.warn("auth: refresh rejected", {
        reason,
        userId: stored?.user_id ?? null,
        tokenAgeDays: stored ? Math.round((Date.now() - new Date(stored.created_at as Date).getTime()) / 86400000) : null,
        ip: request.ip,
      });
      clearRefreshCookie(reply);
      throw ApiError.unauthorized(`Session expired. Please sign in again. (${reason})`);
    };

    if (!stored) return rejected("token_not_found");
    if (stored.revoked) {
      // Revoked by a ROTATION within the grace window (e.g. a loser of a
      // concurrent multi-tab refresh, or a mobile retry after a timed-out
      // first attempt): rotate again instead of ending the session.
      const graceMs = stored.grace_until ? new Date(stored.grace_until as Date).getTime() : 0;
      if (graceMs <= Date.now()) return rejected("token_revoked");
    }
    if (new Date(stored.expires_at as Date) < new Date()) return rejected("token_expired");
    const user = await qOne<Row>(`SELECT * FROM users WHERE id = $1`, [stored.user_id as string]);
    if (!user || !user.is_active) return rejected("user_inactive_or_missing");

    // Rotate atomically: revoke old hash, insert a fresh token, extend lifetime.
    const { refreshToken, accessToken } = await withTx(async (db) => {
      await db.query(
        `UPDATE refresh_tokens
            SET revoked = TRUE,
                grace_until = now() + (GREATEST(0, $2) || ' milliseconds')::interval,
                last_used_at = COALESCE(last_used_at, now())
          WHERE id = $1 AND revoked = FALSE`,
        [stored.id as string, REFRESH_GRACE_MS],
      );
      const newToken = issueRefreshToken();
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, device_info, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          user.id as string,
          hashRefreshToken(newToken),
          deviceInfo(request),
          new Date(Date.now() + REFRESH_DAYS_MS),
        ],
      );
      return {
        refreshToken: newToken,
        accessToken: app.jwt.sign(toPayload(user), { expiresIn: config.jwtAccessExpiresIn }),
      };
    });

    setRefreshCookie(reply, refreshToken);
    logger.info("auth: refresh success (rotated)", { userId: user.id, ip: request.ip });
    // The rotated refresh token is returned ONLY as the httpOnly cookie above.
    // Echoing it in the JSON body would hand a script-readable copy to any XSS
    // on the page and to any proxy that logs response bodies. Clients read it
    // from Set-Cookie; the request side still accepts a body token so existing
    // installed mobile builds keep working.
    return reply.send({
      accessToken,
      expiresInSeconds: 15 * 60,
      user: toUserJson(user),
    });
  });

  // Explicit logout - revokes the refresh token server-side and clears the cookie.
  // This is the ONLY path that ends a session; no timed/idle auto-logout exists.
  app.post("/logout", async (request, reply) => {
    const cookieToken = request.cookies?.[COOKIE];
    const body = (request.body ?? {}) as { refreshToken?: string };
    const candidates = [cookieToken, body.refreshToken].filter((t): t is string => Boolean(t));
    for (const raw of candidates) {
      await qExec(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [
        hashRefreshToken(raw),
      ]);
    }
    clearRefreshCookie(reply);
    return reply.send({ ok: true });
  });

  // Me
  app.get("/me", { preHandler: authenticate }, async (request: AuthenticatedRequest) => {
    const auth = getAuth(request);
    const user = await qOne<Row & DbUser>(`SELECT * FROM users WHERE id = $1`, [auth.id]);
    if (!user) throw ApiError.notFound("User not found");
    const store = user.store_id
      ? await qOne<Row>(`SELECT * FROM stores WHERE id = $1`, [user.store_id])
      : null;
    const roleKey = user.role === "STOCK_MANAGER" ? "STAFF" : String(user.role ?? "STAFF");
    const rolePermissions = user.store_id
      ? await qOne<Row>(`SELECT permissions FROM roles_permissions WHERE store_id = $1 AND role = $2`, [user.store_id, roleKey])
      : null;
    const plan = user.store_id ? await getPlanForBusiness(String(user.store_id)) : null;
    return {
      user: {
        ...toUserJson(user),
        permissions: user.role === "OWNER" ? defaultPermissionsFor("OWNER") : rolePermissions?.permissions ?? defaultPermissionsFor(roleKey),
      },
      store: store && plan ? { ...store, planDetails: plan } : store,
      plan,
    };
  });
}
