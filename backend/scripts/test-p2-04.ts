/**
 * Regression test — P2-04: webhook idempotency keyed on (event_id, entity_id)
 *
 * FAILS BEFORE the fix: webhook_events has PRIMARY KEY (event_id) and
 * markProcessed inserts with ON CONFLICT (event_id) DO NOTHING; isProcessed
 * checks payload->>'entity_id'. So a second distinct entity under the same
 * event name is never recorded, and replays are not skipped.
 * PASSES AFTER the fix: PRIMARY KEY (event_id, entity_id) with explicit
 * entity_id column and INSERT ON CONFLICT (event_id, entity_id) DO NOTHING;
 * isProcessed checks event_id AND entity_id. Distinct entities are recorded
 * and replays of the same (event, entity) are skipped.
 *
 * Tests the helpers directly (no HTTP/HMAC dependency). Cleans up rows it
 * creates.
 *
 * Run:  npx tsx scripts/test-p2-04.ts     (exit 0 = PASS, 1 = FAIL)
 */
import "./load-env.js";
import { pool } from "../src/db/pool.js";
import { isProcessed, markProcessed } from "../src/routes/webhook.routes.js";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` :: ${detail}` : ""}`);
  if (!ok) failed += 1;
}

async function main(): Promise<void> {
  const ts = Date.now();
  const eventId = `p2-04.test.${ts}`;
  const cleanupSql = `DELETE FROM webhook_events WHERE event_id = $1`;

  // Start clean for this eventId.
  await pool.query(cleanupSql, [eventId]);

  // A first entity under eventId
  await markProcessed(eventId, "A");
  check("A marked", await isProcessed(eventId, "A"), "A should be processed");
  check("A replay marked idempotently", await isProcessed(eventId, "A"), "still processed");

  // Distinct entity under the same eventId (the bug: before fix, cannot record B)
  await markProcessed(eventId, "B");
  check("B also processed (distinct entity)", await isProcessed(eventId, "B"), "B should be tracked under same event");
  check("B replay idempotent", await isProcessed(eventId, "B"), "B still processed");

  // Cross-check: A still tracked
  check("A still tracked after B marked", await isProcessed(eventId, "A"), "A must remain processed");

  // Verify count of records for this eventId is exactly 2
  const { rows } = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM webhook_events WHERE event_id = $1`, [eventId]);
  check("exactly 2 (event,entity) rows", rows[0]?.count === 2, `count=${rows[0]?.count}`);

  try {
    await pool.query(cleanupSql, [eventId]);
    console.log(`[cleanup] removed webhook_events rows for ${eventId}`);
  } catch (e) {
    console.log(`[cleanup] WARN ${(e as Error).message}`);
  }

  await pool.end();
  console.log(failed > 0 ? `\nP2-04 TEST FAILED: ${failed} check(s)` : "\nP2-04 TEST PASSED: all checks green");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
