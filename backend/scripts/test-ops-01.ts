/**
 * Regression test — ops-01: OTP email send failure is reported as success.
 *
 * FAILS BEFORE the fix: with MAIL_MODE=brevo and the provider rejecting the
 *   key (401), POST /api/auth/otp/request answers 200 with emailSent:false,
 *   the unusable OTP row stays in the table, and the retry is refused with
 *   OTP_RATE_LIMITED instead of a delivery error.
 * PASSES AFTER the fix: in production the request answers 503
 *   EMAIL_SEND_FAILED with the constant message "Could not send code. Try
 *   again.", the row is deleted, and the 503 body never mentions the account.
 *   A provider success still answers 200, and the unknown-account 404
 *   (P2-09 enumeration contract) is unchanged.
 *
 * The app is built with NODE_ENV=production, which config.ts evaluates once at
 * module load, so the environment is set BEFORE the dynamic import of the app.
 * Brevo is intercepted with undici's MockAgent: no real network, no real key.
 *
 * Run:  npx tsx scripts/test-ops-01.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { MockAgent, setGlobalDispatcher } from "undici";

const TEST_EMAIL = "ops01-otp-delivery@test.invalid";
const UNKNOWN_EMAIL = "ops01-no-such-account@test.invalid";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  // --- production-shaped environment (dotenv will not overwrite these) -----
  process.env.NODE_ENV = "production";
  process.env.MAIL_MODE = "brevo";
  process.env.BREVO_API_KEY = "xkeysib-test-ops01-not-a-real-key";
  process.env.BREVO_SENDER_EMAIL = "noreply@ops01.test";
  process.env.BREVO_SENDER_NAME = "Ops01";
  process.env.APP_URL = "https://ops01.test";
  process.env.OTP_MASTER = "";
  process.env.JWT_ACCESS_SECRET = `ops01-access-secret-${"a".repeat(48)}`;
  process.env.JWT_REFRESH_SECRET = `ops01-refresh-secret-${"b".repeat(48)}`;
  process.env.SUPERADMIN_JWT_SECRET = `ops01-superadmin-secret-${"c".repeat(48)}`;

  // --- intercept Brevo: first call 401 (unrecognised IP), second call 200 --
  const mock = new MockAgent();
  mock.disableNetConnect();
  const brevo = mock.get("https://api.brevo.com");
  brevo
    .intercept({ path: "/v3/smtp/email", method: "POST" })
    .reply(401, { message: "We have detected you are using an unrecognised IP address", code: "unauthorized" });
  brevo
    .intercept({ path: "/v3/smtp/email", method: "POST" })
    .reply(200, { messageId: "ops01-mock-message-id" });
  setGlobalDispatcher(mock);

  const { buildApp } = await import("../src/app.js");
  const { pool, q } = await import("../src/db/pool.js");

  const app = buildApp({ logger: false });
  await app.ready();

  try {
    const countRows = async () => {
      const rows = await q<{ c: number }>(`SELECT COUNT(*)::int AS c FROM otps WHERE email = $1`, [TEST_EMAIL]);
      return rows[0]?.c ?? 0;
    };

    check("no leftover rows from a previous run", (await countRows()) === 0);

    // --- provider 401 -> 503, row removed -----------------------------------
    const failRes = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { email: TEST_EMAIL, purpose: "REGISTER" },
    });
    const failBody = failRes.json() as { error?: string; code?: string };
    check("provider 401 answers 503", failRes.statusCode === 503, `got ${failRes.statusCode} ${failRes.body}`);
    check("code is EMAIL_SEND_FAILED", failBody.code === "EMAIL_SEND_FAILED", String(failBody.code));
    check(
      "message is the constant send-failure text",
      failBody.error === "Could not send code. Try again.",
      String(failBody.error),
    );
    check("503 body does not mention the account", !failRes.body.includes(TEST_EMAIL), failRes.body);
    check("503 body has no devOtp leak", !("devOtp" in failBody));
    check("unusable OTP row is deleted", (await countRows()) === 0, `rows=${await countRows()}`);

    // --- provider success -> 200 --------------------------------------------
    const okRes = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { email: TEST_EMAIL, purpose: "REGISTER" },
    });
    const okBody = okRes.json() as { ok?: boolean; emailSent?: boolean; devOtp?: string };
    check("provider success answers 200", okRes.statusCode === 200, `got ${okRes.statusCode} ${okRes.body}`);
    check("success body reports emailSent true", okBody.ok === true && okBody.emailSent === true, okRes.body);
    check("success body still omits devOtp", okBody.devOtp === undefined);
    check("successful send keeps its row", (await countRows()) === 1, `rows=${await countRows()}`);

    // --- P2-09 enumeration contract unchanged --------------------------------
    const unknownRes = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { email: UNKNOWN_EMAIL, purpose: "LOGIN" },
    });
    const unknownBody = unknownRes.json() as { code?: string };
    check(
      "unknown account still answers 404 ACCOUNT_NOT_FOUND",
      unknownRes.statusCode === 404 && unknownBody.code === "ACCOUNT_NOT_FOUND",
      `${unknownRes.statusCode} ${unknownRes.body}`,
    );
  } finally {
    // --- keep the DB clean ---------------------------------------------------
    await pool.query(`DELETE FROM otps WHERE email = $1`, [TEST_EMAIL]);
    await pool.query(`DELETE FROM otps WHERE email = $1`, [UNKNOWN_EMAIL]);
    await app.close();
    await pool.end();
  }

  console.log(failed === 0 ? "TEST ops-01 PASSED" : `TEST ops-01 FAILED (${failed} check(s))`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[ops-01] harness error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
