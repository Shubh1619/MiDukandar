/**
 * Regression test — P2-10: PIN-reset token is replayable (not single-use).
 *
 * FAILS BEFORE the fix: the same resetToken can run reset-pin twice (200, 200)
 *   and two concurrent replays both succeed.
 * PASSES AFTER the fix: the token carries a persisted jti that is claimed
 *   (consumed_at set) inside the PIN-write transaction, so a replay is 400
 *   RESET_TOKEN_INVALID and a concurrent double-spend yields exactly one 200.
 *
 * Uses tenant B (owner@mazedukan.demo, Pro) to stay clear of tenant A's
 * per-email OTP budget. Cleans up the rows it creates (reset tokens + audit
 * logs); the PIN is left changed on the dev DB, which the recovery flow
 * intends.
 *
 * Run:  npx tsx scripts/test-p2-10.ts     (exit 0 = PASS, 1 = FAIL)
 */
import { buildApp } from "../src/app.js";
import { pool, qOne } from "../src/db/pool.js";
import type { FastifyInstance } from "fastify";

const EMAIL = "owner@mazedukan.demo";
const OTP = "000000";
const json = { "content-type": "application/json" };

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function mintToken(app: FastifyInstance): Promise<string> {
  const init = await app.inject({
    method: "POST",
    url: "/api/auth/recovery/initiate",
    headers: json,
    payload: JSON.stringify({ method: "email", email: EMAIL }),
  });
  if (init.statusCode !== 200) throw new Error(`initiate failed: ${init.statusCode} ${init.body}`);
  const vo = await app.inject({
    method: "POST",
    url: "/api/auth/recovery/verify-otp",
    headers: json,
    payload: JSON.stringify({ identifier: EMAIL, otp: OTP }),
  });
  if (vo.statusCode !== 200) throw new Error(`verify-otp failed: ${vo.statusCode} ${vo.body}`);
  return (vo.json() as { resetToken: string }).resetToken;
}

function reset(app: FastifyInstance, token: string, pin: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/recovery/reset-pin",
    headers: json,
    payload: JSON.stringify({ resetToken: token, newPin: pin, confirmPin: pin }),
  });
}

async function main(): Promise<void> {
  const app = buildApp({ logger: false });
  await app.ready();
  const startedAt = new Date();
  const auditIds: string[] = [];

  // The per-email OTP limiter counts `otps` rows in the last 10 minutes, so
  // clear this (dev-only) email's pending rows to keep the test repeatable.
  await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);

  const token1 = await mintToken(app);
  check("mint reset token (initiate + verify-otp)", Boolean(token1), `len=${token1.length}`);

  const first = await reset(app, token1, "1357");
  check("first reset-pin succeeds", first.statusCode === 200, `status=${first.statusCode} body=${first.body}`);
  const firstBody = first.json() as { auditId?: string };
  if (firstBody.auditId) auditIds.push(firstBody.auditId);

  const replay = await reset(app, token1, "9753");
  check("replay of the SAME token is rejected (4xx)", replay.statusCode >= 400 && replay.statusCode < 500, `status=${replay.statusCode} body=${replay.body}`);
  const replayBody = replay.json() as { code?: string };
  check("replay carries RESET_TOKEN_INVALID", replayBody.code === "RESET_TOKEN_INVALID", `code=${replayBody.code}`);

  const user = await qOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [EMAIL]);
  const consumed = await qOne<{ consumed_at: string | null }>(
    `SELECT consumed_at FROM pin_reset_tokens WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1`,
    [user?.id ?? ""],
  );
  check("token row is marked consumed (single-use persisted)", Boolean(consumed?.consumed_at), `consumed_at=${consumed?.consumed_at}`);

  const token2 = await mintToken(app);
  const [a, b] = await Promise.all([reset(app, token2, "1357"), reset(app, token2, "9753")]);
  const okCount = [a, b].filter((r) => r.statusCode === 200).length;
  check("concurrent double-spend → exactly one success", okCount === 1, `statuses=${a.statusCode},${b.statusCode}`);
  const winner = a.statusCode === 200 ? a : b;
  const wBody = winner.json() as { auditId?: string };
  if (wBody.auditId) auditIds.push(wBody.auditId);

  // ── cleanup: remove rows created by this test ─────────────────────────────
  try {
    if (user?.id) {
      await pool.query(`DELETE FROM pin_reset_tokens WHERE user_id = $1`, [user.id]);
      // Deletes every PIN_RESET audit row this run created, including replay
      // attempts that succeeded BEFORE the fix (so the before-run is clean too).
      await pool.query(`DELETE FROM audit_logs WHERE user_id = $1 AND action = 'PIN_RESET' AND created_at >= $2`, [
        user.id,
        startedAt,
      ]);
    }
    await pool.query(`DELETE FROM otps WHERE email = $1`, [EMAIL]);
    console.log(`[cleanup] removed pin_reset_tokens + PIN_RESET audit_logs for ${EMAIL} (auditIds captured=${auditIds.length})`);
  } catch (e) {
    console.log(`[cleanup] WARN ${(e as Error).message}`);
  }

  await app.close();
  await pool.end();
  console.log(failed > 0 ? `\nP2-10 TEST FAILED: ${failed} check(s)` : "\nP2-10 TEST PASSED: all checks green");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

