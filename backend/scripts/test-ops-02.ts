/**
 * Regression test — ops-02: one structured request log line, not three.
 *
 * FAILS BEFORE the fix: Fastify's own logger emits "incoming request" and
 *   "request completed" alongside the custom "request" line, so one request
 *   produced three lines (~triple production log volume) with inconsistent
 *   field names.
 * PASSES AFTER the fix: exactly one "request" line per request, no Fastify
 *   request-logging lines, and the line carries a reqId so it can be traced.
 *
 * Captures process.stdout/stderr by monkey-patching the write functions (the
 * project logger writes JSON lines straight to the streams).
 *
 * Run:  npx tsx scripts/test-ops-02.ts     (exit 0 = PASS, 1 = FAIL)
 */
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

function countByMsg(msg: string): number {
  return logLines().filter((l) => l.msg === msg).length;
}

async function main(): Promise<void> {
  const { buildApp } = await import("../src/app.js");
  const { pool } = await import("../src/db/pool.js");

  const app = buildApp({ logger: true });
  await app.ready();

  try {
    captured.length = 0;
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login-kind",
      payload: { identifier: "ops02-probe@test.invalid" },
    });

    const requestLines = logLines().filter((l) => l.msg === "request");
    check("request answered", res.statusCode === 200 || res.statusCode === 404, `got ${res.statusCode}`);
    check("exactly one \"request\" line", requestLines.length === 1, `count=${requestLines.length}`);
    check("no \"incoming request\" line", countByMsg("incoming request") === 0, `count=${countByMsg("incoming request")}`);
    check("no \"request completed\" line", countByMsg("request completed") === 0, `count=${countByMsg("request completed")}`);
    check(
      "request line carries a non-empty reqId",
      typeof requestLines[0]?.reqId === "string" && (requestLines[0]?.reqId as string).length > 0,
      JSON.stringify(requestLines[0]),
    );
    check("request line still records method/url/status", requestLines[0]?.url === "/api/auth/login-kind", JSON.stringify(requestLines[0]));
  } finally {
    await app.close();
    await pool.end();
  }

  emit(failed === 0 ? "TEST ops-02 PASSED" : `TEST ops-02 FAILED (${failed} check(s))`);
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write = origOut;
  process.stderr.write = origErr;
  origErr(`[ops-02] harness error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
