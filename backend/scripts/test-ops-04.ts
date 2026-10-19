/**
 * Regression test — ops-04: email/phone PII written to the log stream.
 *
 * FAILS BEFORE the fix: the otp/mail/auth/recovery/store/user log lines and
 *   the dev mail dump carry the recipient's full email address (and the user
 *   invite line the full phone number).
 * PASSES AFTER the fix: maskEmail()/maskPhone() unit behaviour is correct and
 *   no captured log line (or dev console dump) contains a raw identifier.
 *
 * Run:  npx tsx scripts/test-ops-04.ts     (exit 0 = PASS, 1 = FAIL)
 */
export {};

const TEST_EMAIL = "ops04-email-probe@test.invalid";
const MASKED_EMAIL = "o***e@test.invalid";

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
  // Tolerate a missing export so that, before the fix, this test reports the
  // PII leaks as failed assertions rather than crashing in the harness.
  const loggerModule = (await import("../src/lib/logger.js")) as {
    maskEmail?: (value: string) => string;
    maskPhone?: (value: string) => string;
  };
  const email = (v: string) => (typeof loggerModule.maskEmail === "function" ? loggerModule.maskEmail(v) : "<not implemented>");
  const phone = (v: string) => (typeof loggerModule.maskPhone === "function" ? loggerModule.maskPhone(v) : "<not implemented>");

  // --- unit: masking rules ------------------------------------------------
  check("maskEmail keeps first/last local char and the domain", email("owner@midukandar.demo") === "o***r@midukandar.demo", email("owner@midukandar.demo"));
  check("maskEmail handles a 2-char local part", email("ab@x.io") === "a***b@x.io", email("ab@x.io"));
  check("maskEmail handles a 1-char local part", email("a@x.io") === "***@x.io", email("a@x.io"));
  check("maskEmail degrades safely without an @", email("no-at-sign") === "***", email("no-at-sign"));
  check("maskPhone keeps the last four digits", phone("+91 98765 43210") === "********3210", phone("+91 98765 43210"));
  check("maskPhone masks a short number entirely", phone("1234") === "****", phone("1234"));
  check("maskPhone returns empty for empty input", phone("") === "", phone(""));
  check("maskEmail tolerates a null identifier", email(null as unknown as string) === "", email(null as unknown as string));
  check("maskPhone tolerates a null identifier", phone(null as unknown as string) === "", phone(null as unknown as string));

  // --- integration: dev OTP request writes only masked PII -----------------
  const { buildApp } = await import("../src/app.js");
  const { pool, qExec } = await import("../src/db/pool.js");

  const app = buildApp({ logger: false });
  await app.ready();

  try {
    captured.length = 0;
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { email: TEST_EMAIL, purpose: "REGISTER" },
    });
    check("dev OTP request answers 200", res.statusCode === 200, `got ${res.statusCode} ${res.body}`);

    const dump = captured.join("");
    check("raw email never appears in captured output", !dump.includes(TEST_EMAIL));
    check("masked email appears in captured output", dump.includes(MASKED_EMAIL));

    const lines = logLines();
    const mailLog = lines.find((l) => l.msg === "mail:log");
    check("mail:log `to` is masked", mailLog?.to === MASKED_EMAIL, String(mailLog?.to));
    const otpRequested = lines.find((l) => l.msg === "otp: requested");
    check("otp: requested `email` is masked", otpRequested?.email === MASKED_EMAIL, String(otpRequested?.email));
  } finally {
    await qExec(`DELETE FROM otps WHERE email = $1`, [TEST_EMAIL]);
    await pool.end();
    await app.close();
  }

  emit(failed === 0 ? "TEST ops-04 PASSED" : `TEST ops-04 FAILED (${failed} check(s))`);
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  origErr(`[ops-04] harness error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
