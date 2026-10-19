/**
 * Regression test — ops-06: refresh without a token logs at warning level.
 *
 * FAILS BEFORE the fix: POST /api/auth/refresh with no cookie and no body
 *   writes `auth: refresh rejected - no refresh token provided` at warn level,
 *   even though an absent session is routine (first visit, cleared cookies,
 *   logged-out tab) — which buried the rejections that matter.
 * PASSES AFTER the fix: that line is info, while a genuine rejection (an
 *   unknown token) still logs at warn.
 *
 * Run:  npx tsx scripts/test-ops-06.ts     (exit 0 = PASS, 1 = FAIL)
 */
export {};

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
  const { buildApp } = await import("../src/app.js");
  const { pool } = await import("../src/db/pool.js");

  const app = buildApp({ logger: false });
  await app.ready();

  try {
    // --- no token: routine, must be info -----------------------------------
    captured.length = 0;
    const noToken = await app.inject({ method: "POST", url: "/api/auth/refresh", payload: {} });
    check("no-token refresh answers 401", noToken.statusCode === 401, `got ${noToken.statusCode} ${noToken.body}`);
    const noTokenLine = logLines().find((l) => l.msg === "auth: refresh rejected - no refresh token provided");
    check("no-token case is logged", Boolean(noTokenLine));
    check("no-token case logs at info level", noTokenLine?.level === "info", String(noTokenLine?.level));

    // --- unknown token: a real rejection, must stay warn --------------------
    captured.length = 0;
    const badToken = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: "definitely-not-a-real-refresh-token" },
    });
    check("unknown-token refresh answers 401", badToken.statusCode === 401, `got ${badToken.statusCode} ${badToken.body}`);
    const rejectedLine = logLines().find((l) => l.msg === "auth: refresh rejected" && l.reason === "token_not_found");
    check("unknown-token case is logged", Boolean(rejectedLine));
    check("unknown-token case stays at warn level", rejectedLine?.level === "warn", String(rejectedLine?.level));
  } finally {
    await app.close();
    await pool.end();
  }

  emit(failed === 0 ? "TEST ops-06 PASSED" : `TEST ops-06 FAILED (${failed} check(s))`);
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  origErr(`[ops-06] harness error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
