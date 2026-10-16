import crypto from "node:crypto";
import { config } from "../config.js";
import { q, qOne, qExec } from "../db/pool.js";
import { sendMail, renderOtpEmail } from "./mail.js";
import { ApiError } from "./api-error.js";
import { logger } from "./logger.js";

export type OtpPurpose = "LOGIN" | "REGISTER" | "RECOVERY";

function generateOtp(): string {
  const chars = "0123456789";
  let otp = "";
  for (let i = 0; i < config.otpLength; i++) {
    otp += chars[crypto.randomInt(0, chars.length)];
  }
  return otp;
}

export async function requestOtp(email: string, purpose: OtpPurpose = "LOGIN") {
  const normalized = email.trim().toLowerCase();

  const recent = await qOne<{ c: number }>(
    `SELECT COUNT(*) AS c FROM otps WHERE email=$1 AND created_at > now() - interval '10 minutes'`,
    [normalized],
  );
  if ((recent?.c ?? 0) >= 5) {
    throw ApiError.badRequestCode("Too many OTP requests. Try again in a few minutes.", "OTP_RATE_LIMITED");
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  await qExec(
    `INSERT INTO otps (email, otp_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [normalized, crypto.createHash("sha256").update(otp).digest("hex"), purpose, expiresAt],
  );

  const result = await sendMail({
    to: normalized,
    subject: `Your ${config.appName} login code`,
    html: renderOtpEmail(otp, config.appName, config.otpExpiryMinutes),
    text: `Your ${config.appName} OTP is ${otp}. It expires in ${config.otpExpiryMinutes} minutes.`,
  });

  logger.info("otp: requested", { email: normalized, purpose, emailSent: result.ok });

  const devOtp = !config.isProd && config.masterOtp ? config.masterOtp : undefined;

  return {
    ok: true,
    expiresInSeconds: config.otpExpiryMinutes * 60,
    emailSent: result.ok,
    ...(devOtp ? { devOtp } : {}),
  };
}

export async function verifyOtp(email: string, otp: string, purpose: OtpPurpose = "LOGIN") {
  const normalized = email.trim().toLowerCase();

  const latest = await qOne<{ id: string; otpHash: string; expiresAt: Date; attempts: number }>(
    `SELECT id, otp_hash, expires_at, attempts FROM otps
     WHERE email=$1 AND purpose=$2 AND verified=FALSE ORDER BY created_at DESC LIMIT 1`,
    [normalized, purpose],
  );
  if (!latest) {
    throw ApiError.badRequestCode("Invalid OTP. Request a new code.", "OTP_NOT_FOUND");
  }

  // Development-only master code. In production, assertProductionSecrets() in
  // config.ts refuses to boot when OTP_MASTER is set; this guard keeps the
  // bypass inert even if a prod process somehow ends up with the value loaded.
  if (!config.isProd && config.masterOtp && otp.trim() === config.masterOtp) {
    await qExec(`UPDATE otps SET verified = TRUE WHERE id = $1`, [latest.id]);
    logger.info("otp: verified via master code", { email: normalized, purpose });
    return true;
  }

  const hash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
  if (latest.expiresAt < new Date()) {
    throw ApiError.badRequestCode("OTP has expired. Request a new code.", "OTP_EXPIRED");
  }
  if (latest.attempts >= 5) {
    throw ApiError.badRequestCode("Too many attempts. Request a new code.", "OTP_ATTEMPTS_EXCEEDED");
  }
  if (latest.otpHash !== hash) {
    await qExec(`UPDATE otps SET attempts = attempts + 1 WHERE id=$1`, [latest.id]);
    throw ApiError.badRequestCode("Invalid OTP. Check the code and try again.", "OTP_MISMATCH");
  }

  await qExec(`UPDATE otps SET verified = TRUE WHERE id = $1`, [latest.id]);
  logger.info("otp: verified", { email: normalized, purpose });
  return true;
}