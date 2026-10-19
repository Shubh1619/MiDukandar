/**
 * Regression test — ops-05: Brevo failure logs leak the response body.
 *
 * FAILS BEFORE the fix: a provider 401 logs the whole response body (which
 *   echoes the recipient address) alongside the recipient list and subject.
 * PASSES AFTER the fix: the same failure logs only { status, code }, the body
 *   and the raw recipient address never reach the log stream, and the request
 *   still answers 503 EMAIL_SEND_FAILED (ops-01).
 *
 * Uses NODE_ENV=production so the (production-only) failure path is taken, and
 * undici MockAgent so no real request is made and no real key is needed.
 *
 * Run:  npx tsx scripts/test-ops-05.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { MockAgent, setGlobalDispatcher } from "undici";

const TEST_EMAIL = "ops05-pii-in-error@test.invalid";
const API_KEY = "xkeysib-ops05-secret-key";
const BODY_MARKER = "OpsFiveBodyMarker-recognisable-text";

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

let failed = 0;
function emit(line: string): void {
  origOut(`${line}\n`);
}
function check(name: string, ok: boolean, detail = ""): void {
  emit(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}
function logLines(): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const chunk of captured) {
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) continue;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof parsed.msg === "string") out.push(parsed);
      } catch {
        /* not a log line */
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "production";
  process.env.MAIL_MODE = "brevo";
  process.env.BREVO_API_KEY = API_KEY;
  process.env.BREVO_SENDER_EMAIL = "noreply@ops05.test";
  process.env.BREVO_SENDER_NAME = "Ops05";
  process.env.APP_URL = "https://ops05.test";
  process.env.OTP_MASTER = "";
  process.env.JWT_ACCESS_SECRET = `ops05-access-secret-${"a".repeat(48)}`;
  process.env.JWT_REFRESH_SECRET = `ops05-refresh-secret-${"b".repeat(48)}`;
  process.env.SUPERADMIN_JWT_SECRET = `ops05-superadmin-secret-${"c".repeat(48)}`;

  const mock = new MockAgent();
  mock.disableNetConnect();
  mock
    .get("https://api.brevo.com")
    .intercept({ path: "/v3/smtp/email", method: "POST" })
    .reply(401, {
      code: "unauthorized",
      message: `unrecognised IP address for recipient ${TEST_EMAIL} ${BODY_MARKER}`,
    });
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
    check("failured send still answers 503 EMAIL_SEND_FAILED", res.statusCode === 503, `got ${res.statusCode} ${res.body}`);

    const dump = captured.join("");
    const failLine = logLines().find((l) => l.msg === "brevo: failed to send email");
    check("a Brevo failure line was written", Boolean(failLine));
    check("failure line records the HTTP status", failLine?.status === 401, String(failLine?.status));
    check("failure line records Brevo's error code", failLine?.code === "unauthorized", String(failLine?.code));
    check("failure line has no `body` field", failLine !== undefined && !("body" in failLine));
    check("raw response body text is not logged", !dump.includes(BODY_MARKER));
    check("raw recipient address is not logged", !dump.includes(TEST_EMAIL));
    check("API key is not logged", !dump.includes(API_KEY));
    check("no unmasked `to` field on the failure line", failLine !== undefined && !("to" in failLine));

    const rows = await q<{ c: number }>(`SELECT COUNT(*)::int AS c FROM otps WHERE email = $1`, [TEST_EMAIL]);
    check("failed send kept the DB clean (row deleted)", (rows[0]?.c ?? 0) === 0, `rows=${rows[0]?.c ?? 0}`);
  } finally {
    await pool.query(`DELETE FROM otps WHERE email = $1`, [TEST_EMAIL]);
    await app.close();
    await pool.end();
  }

  emit(failed === 0 ? "TEST ops-05 PASSED" : `TEST ops-05 FAILED (${failed} check(s))`);
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  origErr(`[ops-05] harness error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
