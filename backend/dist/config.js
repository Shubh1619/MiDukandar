import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import "./lib/env.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bool = (fallback) => z
    .string()
    .optional()
    .transform((v) => (v === undefined ? fallback : v.trim().toLowerCase() === "true"));
const positiveInt = (fallback) => z
    .string()
    .optional()
    .transform((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
});
const EnvSchema = z.object({
    NODE_ENV: z.string().optional(),
    PORT: z.string().optional(),
    API_PORT: z.string().optional(),
    DATABASE_URL: z
        .string({ required_error: "DATABASE_URL is required" })
        .min(1, "DATABASE_URL is required"),
    ALLOW_REMOTE_DB_IN_DEV: bool(false),
    APP_URL: z.string().optional(),
    APP_NAME: z.string().optional(),
    MAIL_MODE: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    BREVO_SENDER_EMAIL: z.string().optional(),
    BREVO_SENDER_NAME: z.string().optional(),
    JWT_ACCESS_SECRET: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().optional(),
    JWT_ACCESS_EXPIRES_IN: z.string().optional(),
    REFRESH_TOKEN_DAYS: positiveInt(30),
    REFRESH_COOKIE_NAME: z.string().optional(),
    REFRESH_COOKIE_SECURE: z.string().optional(),
    SUPERADMIN_JWT_SECRET: z.string().optional(),
    SUPERADMIN_ACCESS_EXPIRES_IN: z.string().optional(),
    SUPERADMIN_COOKIE_NAME: z.string().optional(),
    SUPERADMIN_IMPERSONATION_MINUTES: positiveInt(30),
    OTP_EXPIRY_MINUTES: positiveInt(1),
    OTP_LENGTH: positiveInt(6),
    OTP_MASTER: z.string().optional(),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    STORAGE_PUBLIC_BASE_URL: z.string().optional(),
    FCM_SERVER_KEY: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    RATE_LIMIT_WINDOW_MS: positiveInt(900000),
    RATE_LIMIT_MAX_REQUESTS: positiveInt(100),
    TRUST_PROXY_HOPS: positiveInt(1),
});
const parsedEnv = EnvSchema.safeParse(process.env);
if (!parsedEnv.success) {
    const details = parsedEnv.error.issues
        .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
        .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
}
const env = parsedEnv.data;
function splitList(value, fallback) {
    if (!value)
        return fallback;
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}
function firstPort(...candidates) {
    for (const candidate of candidates) {
        const n = Number(candidate);
        if (Number.isFinite(n) && n > 0)
            return Math.floor(n);
    }
    return 3000;
}
function hostOf(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        const match = /@([^/:?]+)/.exec(url);
        return match ? match[1] : "";
    }
}
// Hosts considered "local" for the development safety guard below. `db` and
// `host.docker.internal` cover the docker-compose stack; everything else is
// treated as a managed/remote database.
const LOCAL_DB_HOSTS = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "db",
    "postgres",
    "host.docker.internal",
]);
// Published development fallbacks. docker-compose.yml ships these same
// literals, so a deployment that forgets to inject real values would otherwise
// start with forgeable tokens — assertProductionSecrets() below refuses to boot
// in that case.
const DEV_ACCESS_SECRET = "dev-access-secret-change-me-min-32-characters";
const DEV_REFRESH_SECRET = "dev-refresh-secret-change-me-min-32-characters";
const DEV_SUPERADMIN_SECRET = "dev-superadmin-secret-change-me-min-32-characters";
const MIN_SECRET_LENGTH = 32;
const nodeEnv = env.NODE_ENV?.trim() || "development";
const isProd = nodeEnv === "production";
const appUrl = env.APP_URL?.trim() ?? "";
const databaseUrl = env.DATABASE_URL.trim();
const dbHost = hostOf(databaseUrl);
const mailModeRaw = env.MAIL_MODE?.trim().toLowerCase() || (isProd ? "brevo" : "log");
if (mailModeRaw !== "log" && mailModeRaw !== "brevo") {
    throw new Error(`MAIL_MODE must be "log" or "brevo" (got "${env.MAIL_MODE}")`);
}
const mailMode = mailModeRaw;
export const config = {
    nodeEnv,
    isProd,
    port: firstPort(env.API_PORT, env.PORT),
    databaseUrl,
    dbHost,
    jwtAccessSecret: env.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET ?? DEV_REFRESH_SECRET,
    jwtAccessExpiresIn: env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshTokenDays: env.REFRESH_TOKEN_DAYS,
    refreshCookieName: env.REFRESH_COOKIE_NAME ?? "mz_refresh",
    // Browsers silently drop `Secure` cookies over plain HTTP, which would make
    // the refresh cookie never persist (login → 401s after the 15 min access
    // token expires). Default to Secure in production ONLY when the app is truly
    // served over HTTPS (per APP_URL), so local/self-hosted HTTP deployments of
    // a production build keep working. An explicit env var always wins.
    refreshCookieSecure: env.REFRESH_COOKIE_SECURE !== undefined
        ? env.REFRESH_COOKIE_SECURE.trim().toLowerCase() === "true"
        : isProd && appUrl.startsWith("https://"),
    superAdminJwtSecret: env.SUPERADMIN_JWT_SECRET ?? DEV_SUPERADMIN_SECRET,
    superAdminAccessExpiresIn: env.SUPERADMIN_ACCESS_EXPIRES_IN ?? "15m",
    superAdminCookieName: env.SUPERADMIN_COOKIE_NAME ?? "mz_sa",
    superAdminImpersonationMinutes: env.SUPERADMIN_IMPERSONATION_MINUTES,
    mailMode,
    brevoApiKey: env.BREVO_API_KEY?.trim() ?? "",
    brevoSenderEmail: env.BREVO_SENDER_EMAIL?.trim() ?? "",
    brevoSenderName: env.BREVO_SENDER_NAME?.trim() || "MiDukandar",
    otpExpiryMinutes: env.OTP_EXPIRY_MINUTES,
    otpLength: env.OTP_LENGTH,
    masterOtp: env.OTP_MASTER?.trim() ?? "",
    razorpayKeyId: env.RAZORPAY_KEY_ID?.trim() ?? "",
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET?.trim() ?? "",
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "",
    // Optional absolute origin used to build public URLs for locally stored
    // uploads. Falls back to APP_URL (the web origin, which proxies /api/* to
    // this API) so returned image URLs stay same-origin in the browser.
    storagePublicBaseUrl: env.STORAGE_PUBLIC_BASE_URL?.trim() ?? "",
    fcmServerKey: env.FCM_SERVER_KEY?.trim() ?? "",
    sentryDsn: env.SENTRY_DSN?.trim() ?? "",
    appUrl,
    appName: env.APP_NAME?.trim() || "MiDukandar",
    corsAllowedOrigins: [
        ...new Set([
            ...splitList(env.CORS_ALLOWED_ORIGINS ?? env.CORS_ORIGIN, [
                "http://localhost:3000",
                "http://localhost:8080",
            ]),
            ...(appUrl ? [appUrl] : []),
        ]),
    ],
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    uploadDir: path.join(__dirname, "..", "uploads"),
};
/**
 * Fail fast when MAIL_MODE=brevo but the credentials Brevo needs are missing.
 * Without this the first real OTP send would fail at runtime with a confusing
 * 401/400 from Brevo instead of a clear boot-time error.
 */
function assertMailConfig() {
    if (config.mailMode !== "brevo")
        return;
    const missing = [
        ["BREVO_API_KEY", config.brevoApiKey],
        ["BREVO_SENDER_EMAIL", config.brevoSenderEmail],
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);
    if (missing.length > 0) {
        throw new Error(`MAIL_MODE=brevo requires ${missing.join(", ")} to be set (see .env.example). ` +
            `Use MAIL_MODE=log for local development.`);
    }
}
/**
 * Refuses to start a development process against a non-local database.
 *
 * A local run with NODE_ENV=development (OTP_MASTER enabled, verbose logs,
 * dev OTP echoed to clients) pointed at a managed database would happily
 * mutate real customer data. Guard against the common mistake of copying a
 * production DATABASE_URL into a dev shell; set ALLOW_REMOTE_DB_IN_DEV=true to
 * override deliberately.
 */
function assertDevDatabase() {
    if (config.nodeEnv !== "development")
        return;
    if (env.ALLOW_REMOTE_DB_IN_DEV)
        return;
    if (!config.dbHost || LOCAL_DB_HOSTS.has(config.dbHost))
        return;
    throw new Error(`Refusing to start: NODE_ENV=development but DATABASE_URL points at non-local host "${config.dbHost}". ` +
        `Set ALLOW_REMOTE_DB_IN_DEV=true to override, or point DATABASE_URL at localhost.`);
}
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
function assertProductionSecrets() {
    if (!config.isProd)
        return;
    const problems = [];
    const signingKeys = [
        ["JWT_ACCESS_SECRET", config.jwtAccessSecret, DEV_ACCESS_SECRET],
        ["JWT_REFRESH_SECRET", config.jwtRefreshSecret, DEV_REFRESH_SECRET],
        ["SUPERADMIN_JWT_SECRET", config.superAdminJwtSecret, DEV_SUPERADMIN_SECRET],
    ];
    for (const [name, value, devDefault] of signingKeys) {
        if (value === devDefault) {
            problems.push(`${name} is still the published development default`);
        }
        else if (value.trim().length < MIN_SECRET_LENGTH) {
            problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
        }
    }
    if (config.masterOtp) {
        problems.push("OTP_MASTER must not be set in production (it bypasses OTP verification for every account)");
    }
    // An empty webhook secret still produces a valid HMAC (over an empty key), so
    // payment webhooks would be forgeable. Only enforced when Razorpay is enabled.
    if ((config.razorpayKeyId || config.razorpayKeySecret) && !config.razorpayWebhookSecret) {
        problems.push("RAZORPAY_WEBHOOK_SECRET is required when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are set");
    }
    // The refresh cookie defaults to Secure only when APP_URL is https, so a
    // production deployment behind a plain-HTTP APP_URL would put session tokens
    // on the wire in cleartext. An EXPLICIT REFRESH_COOKIE_SECURE (either value)
    // is an operator decision and is honoured — this only rejects the case where
    // the insecure value was reached by accident.
    if (!config.refreshCookieSecure && process.env.REFRESH_COOKIE_SECURE === undefined) {
        problems.push("the refresh cookie must be Secure in production — serve APP_URL over https://, or set REFRESH_COOKIE_SECURE=false to deliberately allow plain HTTP");
    }
    if (problems.length > 0) {
        throw new Error("Refusing to start with insecure production configuration:\n  - " +
            problems.join("\n  - ") +
            "\nSet these explicitly in the environment (see .env.example), or unset NODE_ENV=production for local development.");
    }
}
assertDevDatabase();
assertMailConfig();
assertProductionSecrets();
/**
 * One-line summary of the active configuration, safe to print at startup
 * (never includes secrets). Callers add the current migration version.
 */
export function startupSummary() {
    return {
        env: config.nodeEnv,
        mailMode: config.mailMode,
        dbHost: config.dbHost || "(unset)",
    };
}
