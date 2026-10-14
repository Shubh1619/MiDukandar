import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Config {
  nodeEnv: string;
  isProd: boolean;
  port: number;
  databaseUrl: string;
  directUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  refreshTokenDays: number;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  superAdminJwtSecret: string;
  superAdminAccessExpiresIn: string;
  superAdminCookieName: string;
  superAdminImpersonationMinutes: number;
  brevoApiKey: string;
  brevoSenderEmail: string;
  brevoSenderName: string;
  otpExpiryMinutes: number;
  otpLength: number;
  masterOtp: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2Bucket: string;
  r2PublicBaseUrl: string;
  fcmServerKey: string;
  sentryDsn: string;
  nominatimBaseUrl: string;
  whatsappNumber: string;
  appUrl: string;
  appName: string;
  corsOrigin: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  trustProxyHops: number;
  syncBatchSize: number;
  uploadDir: string;
}

function int(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function list(v: string | undefined, fallback: string[]): string[] {
  if (!v) return fallback;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// Published development fallbacks. docker-compose.yml ships these same literals,
// so a deployment that forgets to inject real values would otherwise start with
// forgeable tokens — assertProductionSecrets() below refuses to boot in that case.
const DEV_ACCESS_SECRET = "dev-access-secret-change-me-min-32-characters";
const DEV_REFRESH_SECRET = "dev-refresh-secret-change-me-min-32-characters";
const DEV_SUPERADMIN_SECRET = "dev-superadmin-secret-change-me-min-32-characters";
const MIN_SECRET_LENGTH = 32;

const appUrl = process.env.APP_URL ?? "";

export const config: Config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: int(process.env.API_PORT, int(process.env.PORT, 3000)),
  databaseUrl: process.env.DATABASE_URL ?? "",
  directUrl: process.env.DIRECT_URL ?? "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  refreshTokenDays: int(process.env.REFRESH_TOKEN_DAYS, 30),
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? "mz_refresh",
  // Browsers silently drop `Secure` cookies over plain HTTP, which would make
  // the refresh cookie never persist (login → 401s after the 15 min access
  // token expires). Default to Secure in production ONLY when the app is truly
  // served over HTTPS (per APP_URL), so local/self-hosted HTTP deployments of
  // a production build keep working. An explicit env var always wins.
  refreshCookieSecure:
    process.env.REFRESH_COOKIE_SECURE !== undefined
      ? process.env.REFRESH_COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production" && appUrl.startsWith("https://"),
  superAdminJwtSecret: process.env.SUPERADMIN_JWT_SECRET ?? DEV_SUPERADMIN_SECRET,
  superAdminAccessExpiresIn: process.env.SUPERADMIN_ACCESS_EXPIRES_IN ?? "15m",
  superAdminCookieName: process.env.SUPERADMIN_COOKIE_NAME ?? "mz_sa",
  superAdminImpersonationMinutes: int(process.env.SUPERADMIN_IMPERSONATION_MINUTES, 30),
  brevoApiKey: process.env.BREVO_API_KEY ?? "",
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL ?? "noreply@midukandar.com",
  brevoSenderName: process.env.BREVO_SENDER_NAME ?? "MiDukandar",
  otpExpiryMinutes: int(process.env.OTP_EXPIRY_MINUTES, 1),
  otpLength: int(process.env.OTP_LENGTH, 6),
  masterOtp: process.env.OTP_MASTER ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  r2Endpoint: process.env.R2_ENDPOINT ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "midukandar",
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
  fcmServerKey: process.env.FCM_SERVER_KEY ?? "",
  sentryDsn: process.env.SENTRY_DSN ?? "",
  nominatimBaseUrl: process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org",
  whatsappNumber: process.env.WHATSAPP_NUMBER ?? "",
  appUrl,
  appName: process.env.APP_NAME ?? "MiDukandar",
  corsOrigin: [
    ...new Set([
      ...list(process.env.CORS_ORIGIN, ["http://localhost:3000", "http://localhost:8080"]),
      ...(appUrl ? [appUrl] : []),
    ]),
  ],
  rateLimitWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 900000),
  rateLimitMaxRequests: int(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  trustProxyHops: int(process.env.TRUST_PROXY_HOPS, 1),
  syncBatchSize: int(process.env.SYNC_BATCH_SIZE, 100),
  uploadDir: path.join(__dirname, "..", "uploads"),
};

/**
 * Refuses to boot when a production process would run on insecure configuration.
 *
 * Every check here corresponds to a publicly-known default that would otherwise
 * be silently inherited: the JWT signing keys are literal strings committed in
 * docker-compose.yml (so any tenant or superadmin token can be forged), and
 * OTP_MASTER is a universal OTP override that authenticates as any account.
 *
 * Invoked for its side effect at module load so every entrypoint is covered
 * (server, migrate, seed) rather than only the HTTP listener.
 */
function assertProductionSecrets(): void {
  if (!config.isProd) return;

  const problems: string[] = [];

  const signingKeys = [
    ["JWT_ACCESS_SECRET", config.jwtAccessSecret, DEV_ACCESS_SECRET],
    ["JWT_REFRESH_SECRET", config.jwtRefreshSecret, DEV_REFRESH_SECRET],
    ["SUPERADMIN_JWT_SECRET", config.superAdminJwtSecret, DEV_SUPERADMIN_SECRET],
  ] as const;

  for (const [name, value, devDefault] of signingKeys) {
    if (value === devDefault) {
      problems.push(`${name} is still the published development default`);
    } else if (value.trim().length < MIN_SECRET_LENGTH) {
      problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
    }
  }

  if (config.masterOtp) {
    problems.push(
      "OTP_MASTER must not be set in production (it bypasses OTP verification for every account)",
    );
  }

  // An empty webhook secret still produces a valid HMAC (over an empty key), so
  // payment webhooks would be forgeable. Only enforced when Razorpay is enabled.
  if ((config.razorpayKeyId || config.razorpayKeySecret) && !config.razorpayWebhookSecret) {
    problems.push(
      "RAZORPAY_WEBHOOK_SECRET is required when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are set",
    );
  }

  // The refresh cookie defaults to Secure only when APP_URL is https, so a
  // production deployment behind a plain-HTTP APP_URL would put session tokens
  // on the wire in cleartext. An EXPLICIT REFRESH_COOKIE_SECURE (either value)
  // is an operator decision and is honoured — this only rejects the case where
  // the insecure value was reached by accident.
  if (!config.refreshCookieSecure && process.env.REFRESH_COOKIE_SECURE === undefined) {
    problems.push(
      "the refresh cookie must be Secure in production — serve APP_URL over https://, or set REFRESH_COOKIE_SECURE=false to deliberately allow plain HTTP",
    );
  }

  if (problems.length > 0) {
    throw new Error(
      "Refusing to start with insecure production configuration:\n  - " +
        problems.join("\n  - ") +
        "\nSet these explicitly in the environment (see .env.example), or unset NODE_ENV=production for local development.",
    );
  }
}

assertProductionSecrets();