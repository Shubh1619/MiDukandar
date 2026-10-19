/**
 * Regression test — mail-01: sender identity comes from the environment and a
 * free-mail sender is refused in production.
 *
 * FAILS BEFORE the fix: the sender was read from BREVO_SENDER_* only, there was
 *   no MAIL_FROM_* handling, and a @gmail.com sender booted production happily.
 * PASSES AFTER: MAIL_FROM_EMAIL/MAIL_FROM_NAME/MAIL_REPLY_TO drive the config
 *   and isFreeMailDomain() — the predicate the production boot guard uses —
 *   flags gmail/yahoo/outlook/hotmail (case-insensitively).
 *
 * The production boot failure itself is an assertProductionSecrets() side
 * effect at module load; this test exercises the exact predicate that guard
 * calls, in-process.
 *
 * Run:  npx tsx scripts/test-mail-01.ts     (exit 0 = PASS, 1 = FAIL)
 */
export {};

let failed = 0;
function check(name: string, ok: boolean, detail?: string): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "development";
  process.env.MAIL_MODE = "log";
  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/mazedukan";
  process.env.MAIL_FROM_EMAIL = "noreply@midukandar.test";
  process.env.MAIL_FROM_NAME = "MiDukandar Test";
  process.env.MAIL_REPLY_TO = "support@midukandar.test";
  delete process.env.BREVO_SENDER_EMAIL;
  process.env.OTP_MASTER = "";

  const { config, isFreeMailDomain } = await import("../src/config.js");

  check("MAIL_FROM_EMAIL is read into config.mailFromEmail", config.mailFromEmail === "noreply@midukandar.test", config.mailFromEmail);
  check("MAIL_FROM_NAME is read into config.mailFromName", config.mailFromName === "MiDukandar Test", config.mailFromName);
  check("MAIL_REPLY_TO is read into config.mailReplyTo", config.mailReplyTo === "support@midukandar.test", config.mailReplyTo);

  check("gmail.com is a free-mail domain", isFreeMailDomain("shop@gmail.com") === true);
  check("yahoo.com is a free-mail domain", isFreeMailDomain("shop@yahoo.com") === true);
  check("outlook.com is a free-mail domain", isFreeMailDomain("shop@outlook.com") === true);
  check("hotmail.com is a free-mail domain", isFreeMailDomain("shop@hotmail.com") === true);
  check("matching is case-insensitive", isFreeMailDomain("Shop@GMAIL.COM") === true);
  check("an owned domain is allowed", isFreeMailDomain("no-reply@midukandar.com") === false);
  check("an address without @ is not flagged", isFreeMailDomain("no-at-sign") === false);
  check("a lookalike domain is not mistaken for gmail.com", isFreeMailDomain("shop@notgmail.com") === false);

  console.log(failed === 0 ? "TEST mail-01 PASSED" : `TEST mail-01 FAILED (${failed} check(s))`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[mail-01] harness error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
