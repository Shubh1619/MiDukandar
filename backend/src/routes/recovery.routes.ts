import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { q, qOne, withTx, type Row } from "../db/pool.js";
import { config } from "../config.js";
import { requestOtp, verifyOtp } from "../lib/otp.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { logger, maskEmail } from "../lib/logger.js";
import { rateLimited } from "../lib/route-rate-limit.js";

const RESET_TOKEN_TTL = "10m";
const RESET_TOKEN_TTL_SECONDS = 10 * 60;

const initiateSchema = z.object({
  method: z.enum(["mobile", "email"]).default("mobile"),
  mobile: z.string().min(4).max(20).optional(),
  email: z.string().email().optional(),
});

const verifyOtpSchema = z.object({
  identifier: z.string().min(1).optional(),
  mobile: z.string().min(4).max(20).optional(),
  otp: z.string().min(4).max(8),
});

const resetPinSchema = z.object({
  resetToken: z.string().min(10),
  newPin: z.string().regex(/^\d{4,8}$/, "PIN must be 4-8 digits"),
  confirmPin: z.string().regex(/^\d{4,8}$/, "PIN must be 4-8 digits"),
});

const mobileQuerySchema = z.object({
  mobile: z.string().min(4).max(20),
});

type Target = {
  email: string;
  userId: string;
  storeId: string | null;
  isActive: boolean;
  matchedMobile: string | null;
};

const onlyDigits = (v: string) => String(v ?? "").replace(/\D/g, "");

// Matches the last 10 digits of the stored phone so +91 / country-code
// prefixes on either side never break the lookup.
const STORE_BY_PHONE = `
  SELECT s.id, s.name, s.city, s.gst, s.phone, s.invoice_prefix,
         u.id AS owner_id, u.name AS owner_name, u.email AS owner_email
  FROM stores s
  LEFT JOIN users u ON u.store_id = s.id AND u.role = 'OWNER'
  WHERE RIGHT(regexp_replace(s.phone, '\\D', '', 'g'), 10) = RIGHT(regexp_replace($1, '\\D', '', 'g'), 10)
  LIMIT 1`;

async function resolveTarget(input: { method?: "mobile" | "email"; mobile?: string; email?: string; identifier?: string }): Promise<Target> {
  const hasEmailInput = Boolean(input.email ?? (input.identifier && input.identifier.includes("@")));
  const method = input.method ?? (hasEmailInput ? "email" : "mobile");

  if (method === "mobile") {
    const digits = onlyDigits(input.mobile ?? input.identifier ?? "");
    if (!digits) throw ApiError.badRequest("A mobile number is required.");
    const store = await qOne<Row>(STORE_BY_PHONE, [digits]);
    if (!store?.ownerId) {
      throw ApiError.notFound("We couldn't find a MiDukandar account for this number.");
    }
    const user = await qOne<Row>(`SELECT id, store_id, email, is_active FROM users WHERE id = $1`, [store.ownerId as string]);
    if (!user) throw ApiError.notFound("We couldn't find a MiDukandar account for this number.");
    return {
      email: String(user.email),
      userId: String(user.id),
      storeId: user.store_id ? String(user.store_id) : null,
      isActive: user.is_active !== false,
      matchedMobile: digits,
    };
  }

  const email = String(input.email ?? input.identifier ?? "").trim().toLowerCase();
  if (!email) throw ApiError.badRequest("An email address is required.");
  const user = await qOne<Row>(`SELECT id, store_id, email, is_active FROM users WHERE email = $1`, [email]);
  if (!user) throw ApiError.notFound("We couldn't find a MiDukandar account for this email.");
  const store = user.store_id ? await qOne<Row>(`SELECT phone FROM stores WHERE id = $1`, [user.store_id as string]) : null;
  return {
    email,
    userId: String(user.id),
    storeId: user.store_id ? String(user.store_id) : null,
    isActive: user.is_active !== false,
    matchedMobile: store?.phone ? onlyDigits(String(store.phone)).slice(-10) || null : null,
  };
}

const isWeakPin = (pin: string) =>
  /^(\d)\1{3,}$/.test(pin) ||
  /^(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)$/.test(pin) ||
  /^(19|20)\d{2}$/.test(pin);

export async function recoveryRoutes(app: FastifyInstance) {
  // Sends a recovery OTP. lib/otp.ts caps deliveries per account; this per-IP
  // limit stops one host from cycling through many accounts' recovery flows.
  app.post("/initiate", rateLimited(10, 600_000), async (request) => {
    const body = parse(initiateSchema, request.body);
    if (body.method === "mobile" && !body.mobile) throw ApiError.badRequest("A mobile number is required.");
    if (body.method === "email" && !body.email) throw ApiError.badRequest("An email address is required.");

    const target = await resolveTarget({ method: body.method, mobile: body.mobile, email: body.email });
    if (!target.isActive) throw ApiError.forbidden("Account is inactive.");

    const result = await requestOtp(target.email, "RECOVERY");
    logger.info("recovery: OTP requested", { email: maskEmail(target.email), emailAccepted: result.emailSent });

    return {
      ok: true,
      method: body.method,
      expiresIn: config.otpExpiryMinutes * 60,
      channels: ["email"],
      matchedMobile: target.matchedMobile,
    };
  });

  // A recovery code is limited to 5 guesses per issuance inside lib/otp.ts;
  // this per-IP limit stops spraying the same code across many accounts.
  app.post("/verify-otp", rateLimited(15, 600_000), async (request) => {
    const body = parse(verifyOtpSchema, request.body);
    if (!body.identifier && !body.mobile) throw ApiError.badRequest("A mobile number or email is required.");

    const target = await resolveTarget({ identifier: body.identifier, mobile: body.mobile });
    if (!target.isActive) throw ApiError.forbidden("Account is inactive.");

    await verifyOtp(target.email, body.otp, "RECOVERY");

    // P2-10: single-use reset token. The jti is persisted now and consumed in
    // the same transaction that writes the new PIN, so a captured token can
    // reset the PIN exactly once. Expired rows for this account are dropped
    // opportunistically so the table cannot grow without bound.
    const jti = randomUUID();
    await q(`DELETE FROM pin_reset_tokens WHERE user_id = $1 AND expires_at < now()`, [target.userId]);
    await q(
      `INSERT INTO pin_reset_tokens (jti, user_id, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
      [jti, target.userId, RESET_TOKEN_TTL_SECONDS],
    );

    const resetToken = app.jwt.sign(
      { sub: target.userId, kind: "PIN_RESET", email: target.email, jti },
      { expiresIn: RESET_TOKEN_TTL },
    );
    return { ok: true, resetToken, expiresInSeconds: RESET_TOKEN_TTL_SECONDS };
  });

  // Spending a reset token costs one request; the token itself is single-use
  // and expires in 10 minutes, so this bound only exists to keep a leaked or
  // guessed token from being replayed in a tight loop from one host.
  app.post("/reset-pin", rateLimited(15, 600_000), async (request) => {
    const body = parse(resetPinSchema, request.body);
    if (body.newPin !== body.confirmPin) throw ApiError.badRequest("PINs do not match.");
    if (isWeakPin(body.newPin)) throw ApiError.badRequest("Pick a stronger PIN that isn't repeated or sequential.");

    let payload: { kind?: string; sub?: string; jti?: string };
    try {
      payload = app.jwt.verify<{ kind?: string; sub?: string; jti?: string }>(body.resetToken);
    } catch {
      throw ApiError.badRequestCode("Invalid or expired reset token. Start over.", "RESET_TOKEN_INVALID");
    }
    // A token minted without a jti predates single-use tracking (P2-10) and is
    // rejected rather than accepted with an unverifiable spend state.
    if (payload?.kind !== "PIN_RESET" || !payload.sub || !payload.jti) {
      throw ApiError.badRequestCode("Invalid reset token.", "RESET_TOKEN_INVALID");
    }

    const user = await qOne<Row>(`SELECT id, store_id, is_active FROM users WHERE id = $1`, [payload.sub]);
    if (!user) throw ApiError.notFound("Account not found.");
    if (user.is_active === false) throw ApiError.forbidden("Account is inactive.");

    const pinHash = await bcrypt.hash(body.newPin, 10);

    const auditId = await withTx(async (db) => {
      // P2-10: claim the token first, in the same transaction as the PIN
      // write. `WHERE consumed_at IS NULL` makes the claim atomic, so two
      // concurrent replays of one token cannot both succeed, and a rollback
      // anywhere later in this transaction restores the token to unspent.
      const claimed = await db.query(
        `UPDATE pin_reset_tokens SET consumed_at = now()
         WHERE jti = $1 AND user_id = $2 AND consumed_at IS NULL AND expires_at > now()
         RETURNING id`,
        [payload.jti as string, user.id],
      );
      if (!claimed.rowCount) {
        throw ApiError.badRequestCode("Invalid or expired reset token. Start over.", "RESET_TOKEN_INVALID");
      }

      await db.query(`UPDATE users SET pin_hash = $1, updated_at = now() WHERE id = $2`, [pinHash, user.id]);
      await db.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`, [user.id]);
      const [audit] = await db.q<Row>(
        `INSERT INTO audit_logs (user_id, store_id, action, detail, ip)
         VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
        [
          user.id,
          user.store_id ?? null,
          "PIN_RESET",
          JSON.stringify({ channel: "recovery", method: "otp" }),
          request.ip,
        ],
      );
      return String(audit.id);
    });

    logger.info("recovery: PIN reset", { userId: user.id, storeId: user.store_id });

    return {
      ok: true,
      auditId,
      invalidated: { posTerminals: true, staffSessions: true, mobileSessions: false, branches: false },
    };
  });
}

export async function merchantVerifyRoutes(app: FastifyInstance) {
  // P2-08: this lookup runs pre-auth (the forgot-PIN flow), so it cannot be
  // gated behind `authenticate`. It is therefore reduced to a single non-PII
  // fact — does this number match a registered store? — with no store name,
  // city, owner, GSTIN, terminal id or ledger/revenue counts. The route also
  // carries its own per-IP budget so the boolean cannot be swept to map which
  // phone numbers have an account.
  app.get(
    "/verify-context",
    rateLimited(30, 60_000),
    async (request) => {
      const { mobile } = parse(mobileQuerySchema, request.query);
      const store = await qOne<Row>(STORE_BY_PHONE, [onlyDigits(mobile)]);
      return { ok: true, matched: Boolean(store?.ownerId) };
    },
  );
}
