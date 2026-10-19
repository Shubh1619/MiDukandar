/**
 * Regression test — ops-03: health probes flood the request log.
 *
 * FAILS BEFORE the fix: GET /api/health writes a "request" line on every
 *   probe, so at platform cadence the log is mostly health checks.
 * PASSES AFTER the fix: the exact health paths (/health, /api/health) produce
 *   no request line, while any other path — including an unknown sub-path of
 *   health, which surfaces a typo'd probe URL — still logs.
 *
 * Run:  npx tsx scripts/test-ops-03.ts     (exit 0 = PASS, 1 = FAIL)
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
function requestLines(): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const chunk of captured) {
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) continue;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed.msg === "request") out.push(parsed);
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

  const app = buildApp({ logger: true });
  await app.ready();

  try {
    // --- exact health paths: no request line ------------------------------
    captured.length = 0;
    const health = await app.inject({ method: "GET", url: "/api/health" });
    check("health probe answers 200", health.statusCode === 200, `got ${health.statusCode}`);
    check("no request line for /api/health", requestLines().length === 0, `count=${requestLines().length}`);

    captured.length = 0;
    const healthQuery = await app.inject({ method: "GET", url: "/api/health?verbose=1" });
    check("health probe with query answers 200", healthQuery.statusCode === 200, `got ${healthQuery.statusCode}`);
    check("query string is ignored when skipping", requestLines().length === 0, `count=${requestLines().length}`);

    captured.length = 0;
    await app.inject({ method: "GET", url: "/health" });
    check("no request line for /health", requestLines().length === 0, `count=${requestLines().length}`);

    // --- non-health paths: still exactly one line each --------------------
    captured.length = 0;
    await app.inject({ method: "GET", url: "/api/health/typo-probe" });
    const typoLines = requestLines();
    check("unknown health sub-path still logs", typoLines.length === 1, `count=${typoLines.length}`);
    check(
      "the logged sub-path is the one requested",
      typoLines[0]?.url === "/api/health/typo-probe",
      JSON.stringify(typoLines[0]),
    );

    captured.length = 0;
    await app.inject({
      method: "POST",
      url: "/api/auth/login-kind",
      payload: { identifier: "ops03-probe@test.invalid" },
    });
    check("ordinary request still logs one line", requestLines().length === 1, `count=${requestLines().length}`);
  } finally {
    await app.close();
    await pool.end();
  }

  emit(failed === 0 ? "TEST ops-03 PASSED" : `TEST ops-03 FAILED (${failed} check(s))`);
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  origErr(`[ops-03] harness error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
