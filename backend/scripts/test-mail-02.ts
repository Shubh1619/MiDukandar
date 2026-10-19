/**
 * Unit test — mail-02: login-code email content.
 *
 * Asserts the rendered message is a plain transactional OTP:
 *   - subject is "<code> is your <App> login code"
 *   - the HTML body contains the code exactly once
 *   - a plain-text part exists and carries the code exactly once
 *   - the expiry and the "you can ignore this" line are present
 *   - there are no images or links (no <img>, no href, no tracking pixel)
 *
 * Run:  npx tsx scripts/test-mail-02.ts     (exit 0 = PASS, 1 = FAIL)
 */
export {};

const OTP = "483920";
const APP = "MiDukandar";
const EXPIRY = 5;

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

let failed = 0;
function check(name: string, ok: boolean, detail?: string): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "development";
  process.env.MAIL_MODE = "log";
  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/mazedukan";
  process.env.OTP_MASTER = "";

  const { renderOtpEmail } = await import("../src/lib/mail.js");
  const email = renderOtpEmail(OTP, APP, EXPIRY);

  check("subject names the code", email.subject === `${OTP} is your ${APP} login code`, email.subject);
  check("has an html part", typeof email.html === "string" && email.html.length > 0);
  check("has a plain-text part", typeof email.text === "string" && email.text.length > 0);
  check("html carries the code exactly once", count(email.html, OTP) === 1, `count=${count(email.html, OTP)}`);
  check("text carries the code exactly once", count(email.text, OTP) === 1, `count=${count(email.text, OTP)}`);
  check("html states the expiry", email.html.includes(`${EXPIRY} minutes`), email.html.slice(0, 0));
  check("text states the expiry", email.text.includes(`${EXPIRY} minutes`));
  check("html tells the user to ignore if unrequested", /didn't request this code, you can safely ignore/i.test(email.html));
  check("text tells the user to ignore if unrequested", /didn't request this code, you can safely ignore/i.test(email.text));
  check("no <img> in the html", !/<img/i.test(email.html));
  check("no links in the html", !/href=/i.test(email.html) && !/https?:\/\//i.test(email.html));

  const single = renderOtpEmail(OTP, APP, 1);
  check("singular expiry reads \"1 minute\"", single.text.includes("1 minute") && !single.text.includes("1 minutes"), single.text);

  console.log(failed === 0 ? "TEST mail-02 PASSED" : `TEST mail-02 FAILED (${failed} check(s))`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[mail-02] harness error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
