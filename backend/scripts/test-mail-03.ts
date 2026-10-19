/**
 * Regression test — mail-03: delivery logs.
 *
 * FAILS BEFORE: a successful Brevo send logged "brevo: email sent" with the
 *   subject (which contains the OTP), and the OTP/recovery log lines used the
 *   field name `emailSent`.
 * PASSES AFTER: the line is "brevo: accepted" and keeps the messageId; no log
 *   line carries the subject (the code) or the unmasked recipient; the
 *   "otp: requested" line reports `emailAccepted`.
 *
 * Uses NODE_ENV=production and undici MockAgent (no real request/key).
 *
 * Run:  npx tsx scripts/test-mail-03.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { MockAgent, setGlobalDispatcher } from "undici";

const TEST_EMAIL = "mail03-recipient@test.invalid";
const API_KEY = "xkeysib-mail03-secret-key";
const MESSAGE_ID = "mail03-mock-message-id";

const captured: string[] = [];
const origOut = process.stdout.write.bind(process.stdout);
const origErr = process.stderr.write.bind(process.stderr);
process.stdout.write = ((chunk: unknown) => {
  captured.push(String(chunk));
  return true;
}) as typeof process.stdout.write;
process.stderr.write = ((chunk: unknown) => {
  captured.push(String(chunk));
  return true;
}) as typeof process.stderr.write;

function logLines(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const chunk of captured.join("").split("\n")) {
    const line = chunk.trim();
    if (!line.startsWith("{") || !line.endsWith("}")) continue;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (typeof parsed.msg === "string") out.push(parsed);
    } catch {
      /* not a log line */
    }
  }
  return out;
}

let failed = 0;
function check(name: string, ok: boolean, detail?: string): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "production";
  process.env.MAIL_MODE = "brevo";
  process.env.BREVO_API_KEY = API_KEY;
  process.env.MAIL_FROM_EMAIL = "noreply@mail03.test";
  process.env.MAIL_FROM_NAME = "Mail03";
  process.env.APP_URL = "https://mail03.test";
  process.env.OTP_MASTER = "";
  process.env.JWT_ACCESS_SECRET = `mail03-access-secret-${"a".repeat(48)}`;
  process.env.JWT_REFRESH_SECRET = `mail03-refresh-secret-${"b".repeat(48)}`;
  process.env.SUPERADMIN_JWT_SECRET = `mail03-superadmin-secret-${"c".repeat(48)}`;

  const mock = new MockAgent();
  mock.disableNetConnect();
  mock
    .get("https://api.brevo.com")
    .intercept({ path: "/v3/smtp/email", method: "POST" })
    .reply(200, { messageId: MESSAGE_ID });
  setGlobalDispatcher(mock);

  const { buildApp } = await import("../src/app.js");
  const { pool, q } = await import("../src/db/pool.js");

  const app = buildApp({ logger: false });
  await app.ready();

  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { email: TEST_EMAIL, purpose: "REGISTER" },
    });
    check("accepted send answers 200", res.statusCode === 200, `got ${res.statusCode} ${res.body}`);

    const lines = logLines();
    const accept = lines.find((l) => l.msg === "brevo: accepted");
    const oldLine = lines.find((l) => l.msg === "brevo: email sent");
    const otpLine = lines.find((l) => l.msg === "otp: requested");
    const dump = captured.join("");

    check("a \"brevo: accepted\" line is written", Boolean(accept));
    check("the old \"brevo: email sent\" line is gone", oldLine === undefined);
    check("the accepted line keeps the messageId", accept?.messageId === MESSAGE_ID, String(accept?.messageId));
    check("no log line carries `subject`", !lines.some((l) => "subject" in l));
    check("the OTP log line reports emailAccepted", otpLine?.emailAccepted === true, String(otpLine?.emailAccepted));
    check("the OTP log line no longer reports emailSent", otpLine !== undefined && !("emailSent" in otpLine));
    check("the code-bearing subject text is not logged", !dump.includes("is your"));
    check("the unmasked recipient is not logged", !dump.includes(TEST_EMAIL));
    check("the API key is not logged", !dump.includes(API_KEY));
  } finally {
    await pool.query(`DELETE FROM otps WHERE email = $1`, [TEST_EMAIL]);
    await app.close();
    await pool.end();
  }

  process.stdout.write = origOut;
  process.stderr.write = origErr;
  console.log(failed === 0 ? "TEST mail-03 PASSED" : `TEST mail-03 FAILED (${failed} check(s))`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  origErr(`[mail-03] harness error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
