/**
 * Regression test — mail-04: Brevo delivery webhook.
 *
 * FAILS BEFORE: there was no /api/webhooks/brevo route (404), so delivery
 *   failures were invisible.
 * PASSES AFTER: the endpoint verifies a shared secret (header or ?token=),
 *   rejects a wrong/absent secret with 401, and logs failing delivery events
 *   (blocked, bounces, spam, unsubscribed) at warn with a masked recipient,
 *   the event, the reason and the messageId. It is idempotent (no writes).
 *
 * NODE_ENV=production so config takes the production branch; no network or
 * database rows are touched.
 *
 * Run:  npx tsx scripts/test-mail-04.ts     (exit 0 = PASS, 1 = FAIL)
 */
const SECRET = "mail04-shared-secret";
const EMAIL = "victim@example.com";
const MASKED = "v***m@example.com";
const MESSAGE_ID = "<mail04-abc@smtp-relay.mailin.fr>";

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
function check(name: string, ok: boolean, detail?: string): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "production";
  process.env.MAIL_MODE = "brevo";
  process.env.BREVO_API_KEY = "xkeysib-mail04-not-a-real-key";
  process.env.MAIL_FROM_EMAIL = "noreply@mail04.test";
  process.env.MAIL_FROM_NAME = "Mail04";
  process.env.BREVO_WEBHOOK_SECRET = SECRET;
  process.env.APP_URL = "https://mail04.test";
  process.env.OTP_MASTER = "";
  process.env.JWT_ACCESS_SECRET = `mail04-access-secret-${"a".repeat(48)}`;
  process.env.JWT_REFRESH_SECRET = `mail04-refresh-secret-${"b".repeat(48)}`;
  process.env.SUPERADMIN_JWT_SECRET = `mail04-superadmin-secret-${"c".repeat(48)}`;

  const { buildApp } = await import("../src/app.js");
  const { pool } = await import("../src/db/pool.js");

  const app = buildApp({ logger: false });
  await app.ready();

  try {
    const noSecret = await app.inject({ method: "POST", url: "/api/webhooks/brevo", payload: { event: "blocked" } });
    check("absent secret is rejected with 401", noSecret.statusCode === 401, `got ${noSecret.statusCode}`);

    const wrong = await app.inject({
      method: "POST",
      url: "/api/webhooks/brevo",
      headers: { "x-brevo-webhook-secret": "not-the-secret" },
      payload: { event: "blocked" },
    });
    check("wrong secret is rejected with 401", wrong.statusCode === 401, `got ${wrong.statusCode}`);

    const blocked = await app.inject({
      method: "POST",
      url: "/api/webhooks/brevo",
      headers: { "x-brevo-webhook-secret": SECRET },
      payload: { event: "blocked", email: EMAIL, reason: "sender blocked", "message-id": MESSAGE_ID },
    });
    check("valid header secret answers 200", blocked.statusCode === 200, `got ${blocked.statusCode} ${blocked.body}`);

    const spam = await app.inject({
      method: "POST",
      url: `/api/webhooks/brevo?token=${SECRET}`,
      payload: { event: "spam", email: EMAIL, reason: "marked as spam", "message-id": MESSAGE_ID },
    });
    check("valid query token answers 200", spam.statusCode === 200, `got ${spam.statusCode} ${spam.body}`);

    const delivered = await app.inject({
      method: "POST",
      url: "/api/webhooks/brevo",
      headers: { "x-brevo-webhook-secret": SECRET },
      payload: { event: "delivered", email: EMAIL, "message-id": MESSAGE_ID },
    });
    check("a non-failure event answers 200", delivered.statusCode === 200, `got ${delivered.statusCode}`);

    const repeat = await app.inject({
      method: "POST",
      url: "/api/webhooks/brevo",
      headers: { "x-brevo-webhook-secret": SECRET },
      payload: { event: "blocked", email: EMAIL, reason: "sender blocked", "message-id": MESSAGE_ID },
    });
    check("replaying the same event is accepted (idempotent)", repeat.statusCode === 200, `got ${repeat.statusCode}`);

    const lines = captured.join("");
    const failures = capturedLines(captured).filter((l) => l.msg === "brevo: delivery failed");
    check("failure events are logged at warn", failures.length === 3, `count=${failures.length}`);
    const first = failures[0];
    check("failure line records the event", first?.event === "blocked", String(first?.event));
    check("failure line records the reason", first?.reason === "sender blocked", String(first?.reason));
    check("failure line records the messageId", first?.messageId === MESSAGE_ID, String(first?.messageId));
    check("failure line masks the recipient", first?.email === MASKED, String(first?.email));
    check("failure lines use level warn", failures.every((l) => l.level === "warn"), JSON.stringify(failures.map((l) => l.level)));
    check("the delivered event is not logged as a failure", !failures.some((l) => l.event === "delivered"));
    check("the unmasked recipient is never logged", !lines.includes(EMAIL));
  } finally {
    await app.close();
    await pool.end();
  }

  process.stdout.write = origOut;
  process.stderr.write = origErr;
  console.log(failed === 0 ? "TEST mail-04 PASSED" : `TEST mail-04 FAILED (${failed} check(s))`);
  process.exit(failed === 0 ? 0 : 1);
}

function capturedLines(store: string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const chunk of store.join("").split("\n")) {
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

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  origErr(`[mail-04] harness error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
