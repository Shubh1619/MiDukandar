import { config } from "../config.js";
import { q, qOne } from "../db/pool.js";
import { istDateKey } from "../lib/ist.js";
import { logger, maskPhone } from "../lib/logger.js";
import { normalizeIndianMobile } from "../lib/phone.js";
import { getPlatformSettings } from "../lib/platform-settings.js";
import { sendSms } from "../lib/sms-provider.js";
import { renderUdhaariCreatedSms, UDHAARI_TEMPLATE_KEY } from "../lib/sms-template.js";

/**
 * Udhaari notification SMS.
 *
 * The caller (POST /api/udhaari) invokes `notifyUdhaariCreated` after the
 * udhaari transaction has committed and does not await it, so a slow or down
 * gateway can never delay — let alone fail — the credit entry itself.
 *
 * Flow:
 *   1. Load the store/customer settings and decide whether to send.
 *   2. Insert an audit row (one per udhaari entry, enforced by a unique
 *      index), so retries/duplicate calls cannot text the customer twice.
 *   3. Reserve one unit of the store's daily free allowance with a single
 *      conditional upsert (atomic under concurrency).
 *   4. Send; on a transient failure schedule a retry, on a permanent failure
 *      mark FAILED and refund the allowance.
 *
 * A background sweeper re-drives queued rows, including any left `SENDING`
 * by a process crash, so a restart does not strand messages.
 */

const MAX_ATTEMPTS = 3;
/** Retry delays (seconds) after attempt 1 and attempt 2. */
const RETRY_DELAYS = [60, 300];
const STALE_SENDING_MINUTES = 10;

type SmsStatus =
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "SKIPPED_QUOTA"
  | "SKIPPED_NO_MOBILE"
  | "SKIPPED_OPT_OUT"
  | "SKIPPED_DISABLED";

interface StoreRow {
  name: string;
  sms_udhaari_enabled: boolean;
  sms_daily_limit: number;
}

interface CustomerRow {
  name: string;
  sms_opt_out: boolean;
}

interface SmsRow {
  id: string;
  store_id: string;
  to_phone: string;
  template_body: string;
  body: string;
  variables: unknown;
  attempts: number;
  quota_day: string | null;
  quota_reserved: boolean;
}

interface OutstandingRow {
  total: unknown;
  paid: unknown;
}

export interface UdhaariSmsInput {
  storeId: string;
  customerId: string;
  customerMobile: string | null;
  entryId: string;
  /** Amount of the entry that was just created. */
  amount: number;
  createdById: string | null;
}

/** Customer's total outstanding across all udhaari entries, after this one. */
async function outstandingFor(storeId: string, customerId: string): Promise<number> {
  const row = await qOne<OutstandingRow>(
    `SELECT
       COALESCE((SELECT SUM(e.amount) FROM udhaari_entries e
                  WHERE e.store_id = $1 AND e.customer_id = $2), 0) AS total,
       COALESCE((SELECT SUM(p.amount) FROM udhaari_payments p
                   JOIN udhaari_entries e ON e.id = p.udhaari_entry_id
                  WHERE e.store_id = $1 AND e.customer_id = $2), 0) AS paid`,
    [storeId, customerId],
  );
  return Math.max(0, Number(row?.total ?? 0) - Number(row?.paid ?? 0));
}

/**
 * Reserves one unit of the store's allowance for `day`.
 *
 * The conditional upsert is the whole concurrency story: `WHERE used_count <
 * limit` is evaluated under the row lock taken by `ON CONFLICT DO UPDATE`, so
 * parallel sends are serialized and the allowance can never be overshot.
 * Returns false when the store's free SMS for that day are used up.
 */
async function reserveQuota(storeId: string, day: string, limit?: number): Promise<boolean> {
  let cap = limit;
  if (cap === undefined) {
    const store = await qOne<{ sms_daily_limit: number }>(
      `SELECT sms_daily_limit FROM stores WHERE id = $1`,
      [storeId],
    );
    cap = Number(store?.sms_daily_limit ?? config.smsDailyFreeLimit);
  }
  if (!(cap > 0)) return false;

  const reserved = await qOne<{ used_count: number }>(
    `INSERT INTO sms_usage_daily (store_id, day, used_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (store_id, day) DO UPDATE
       SET used_count = sms_usage_daily.used_count + 1,
           updated_at = now()
       WHERE sms_usage_daily.used_count < $3
     RETURNING used_count`,
    [storeId, day, cap],
  );
  return Boolean(reserved);
}

/**
 * Creates and sends the SMS for a freshly committed udhaari entry.
 * Never throws: failures are logged and recorded on the audit row.
 */
export async function notifyUdhaariCreated(input: UdhaariSmsInput): Promise<void> {
  try {
    const store = await qOne<StoreRow>(
      `SELECT name, sms_udhaari_enabled, sms_daily_limit FROM stores WHERE id = $1`,
      [input.storeId],
    );
    if (!store) return;

    const customer = await qOne<CustomerRow>(
      `SELECT name, sms_opt_out FROM customers WHERE id = $1 AND store_id = $2`,
      [input.customerId, input.storeId],
    );
    if (!customer) return;

    const settings = await getPlatformSettings();
    const phone = normalizeIndianMobile(input.customerMobile);
    // The column is NOT NULL DEFAULT 100, so 0 is an explicit "off", not a
    // missing value. Only a genuinely absent row falls back to the env default.
    const limit =
      store.sms_daily_limit === null || store.sms_daily_limit === undefined
        ? config.smsDailyFreeLimit
        : Number(store.sms_daily_limit);

    let skipStatus: SmsStatus | null = null;
    let skipReason: string | null = null;
    if (!store.sms_udhaari_enabled) {
      skipStatus = "SKIPPED_DISABLED";
      skipReason = "store_disabled";
    } else if (settings.sms_paused) {
      skipStatus = "SKIPPED_DISABLED";
      skipReason = "platform_paused";
    } else if (limit <= 0) {
      skipStatus = "SKIPPED_DISABLED";
      skipReason = "daily_limit_zero";
    } else if (!phone) {
      skipStatus = "SKIPPED_NO_MOBILE";
      skipReason = "missing_or_invalid_mobile";
    } else if (customer.sms_opt_out) {
      skipStatus = "SKIPPED_OPT_OUT";
      skipReason = "customer_opt_out";
    }

    const outstanding = await outstandingFor(input.storeId, input.customerId);
    const content = renderUdhaariCreatedSms({
      customerName: customer.name,
      shopName: store.name,
      amount: input.amount,
      outstanding,
    });

    const day = istDateKey();
    const auditPhone = phone ?? (input.customerMobile ?? "").trim().slice(0, 20);

    // The unique index on (store, reference_type, reference_id) makes this
    // idempotent: a duplicated notify call inserts nothing and returns null.
    const row = await qOne<{ id: string }>(
      `INSERT INTO sms_messages
         (store_id, customer_id, reference_type, reference_id, to_phone,
          template_key, template_body, variables, body, status, error_code,
          quota_day, created_by_id)
       VALUES ($1, $2, 'UDHAARI_ENTRY', $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)
       ON CONFLICT (store_id, reference_type, reference_id)
         WHERE reference_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        input.storeId,
        input.customerId,
        input.entryId,
        auditPhone,
        UDHAARI_TEMPLATE_KEY,
        content.templateBody,
        JSON.stringify(content.variables),
        content.body,
        skipStatus ?? "QUEUED",
        skipReason,
        skipStatus ? null : day,
        input.createdById,
      ],
    );

    if (!row) return;

    if (skipStatus) {
      logger.info("sms: skipped", {
        storeId: input.storeId,
        entryId: input.entryId,
        status: skipStatus,
        reason: skipReason,
        to: maskPhone(auditPhone),
      });
      return;
    }

    // Reserve the allowance before sending. If the process dies between here
    // and the claim in `deliverSmsRow`, the row is still QUEUED and the
    // sweeper checks `quota_reserved` before it sends, so a message is never
    // delivered without a reserved unit.
    const reserved = await reserveQuota(input.storeId, day, limit);

    if (!reserved) {
      await q(
        `UPDATE sms_messages
            SET status = 'SKIPPED_QUOTA', error_code = 'daily_limit_reached', updated_at = now()
          WHERE id = $1`,
        [row.id],
      );
      logger.warn("sms: quota exceeded", {
        storeId: input.storeId,
        entryId: input.entryId,
        limit,
        day,
        to: maskPhone(auditPhone),
      });
      return;
    }

    await q(`UPDATE sms_messages SET quota_reserved = TRUE, updated_at = now() WHERE id = $1`, [row.id]);
    await deliverSmsRow(row.id);
  } catch (err) {
    logger.error("sms: notify failed", {
      storeId: input.storeId,
      entryId: input.entryId,
      error: String(err),
    });
  }
}

/** Gives back one unit after a permanent failure (nothing was delivered). */
async function refundQuota(storeId: string, quotaDay: string | null): Promise<void> {
  if (!quotaDay) return;
  await q(
    `UPDATE sms_usage_daily
        SET used_count = GREATEST(used_count - 1, 0), updated_at = now()
      WHERE store_id = $1 AND day = $2`,
    [storeId, quotaDay],
  );
}

/** Claims and sends one queued row. Safe to call concurrently. */
async function deliverSmsRow(id: string): Promise<void> {
  const row = await qOne<SmsRow>(
    `UPDATE sms_messages
        SET status = 'SENDING', attempts = attempts + 1, updated_at = now()
      WHERE id = $1 AND status = 'QUEUED' AND attempts < $2
      RETURNING id, store_id, to_phone, template_body, body, variables, attempts, quota_day, quota_reserved`,
    [id, MAX_ATTEMPTS],
  );
  if (!row) return;

  // Normally true: notify reserved the unit before calling. A row recovered
  // by the sweeper after a crash (or one whose reservation step failed) still
  // has to take its unit here before it can be sent.
  if (!row.quota_reserved) {
    const ok = row.quota_day ? await reserveQuota(row.store_id, row.quota_day) : false;
    if (!ok) {
      await q(
        `UPDATE sms_messages
            SET status = 'SKIPPED_QUOTA', error_code = 'daily_limit_reached',
                next_attempt_at = NULL, updated_at = now()
          WHERE id = $1`,
        [row.id],
      );
      logger.warn("sms: quota exceeded before retry", {
        storeId: row.store_id,
        to: maskPhone(row.to_phone),
      });
      return;
    }
    await q(`UPDATE sms_messages SET quota_reserved = TRUE, updated_at = now() WHERE id = $1`, [row.id]);
  }

  const res = await sendSms({
    to: row.to_phone,
    body: row.body,
    templateBody: row.template_body,
    variables: Array.isArray(row.variables) ? row.variables.map(String) : [],
  });

  if (res.ok) {
    await q(
      `UPDATE sms_messages
          SET status = 'SENT', provider = $2, provider_message_id = $3,
              error_code = NULL, next_attempt_at = NULL, updated_at = now()
        WHERE id = $1`,
      [row.id, res.mode, res.providerMessageId ?? null],
    );
    logger.info("sms: sent", {
      storeId: row.store_id,
      to: maskPhone(row.to_phone),
      messageId: res.providerMessageId,
    });
    return;
  }

  const attempts = Number(row.attempts);
  const terminal = Boolean(res.permanent) || attempts >= MAX_ATTEMPTS;

  if (terminal) {
    await q(
      `UPDATE sms_messages
          SET status = 'FAILED', error_code = $2, next_attempt_at = NULL, updated_at = now()
        WHERE id = $1`,
      [row.id, res.error ?? "SMS_FAILED"],
    );
    await refundQuota(row.store_id, row.quota_day);
    logger.error("sms: failed permanently", {
      storeId: row.store_id,
      to: maskPhone(row.to_phone),
      error: res.error,
      attempts,
    });
    return;
  }

  const delay = RETRY_DELAYS[Math.min(attempts, RETRY_DELAYS.length) - 1] ?? RETRY_DELAYS[0];
  await q(
    `UPDATE sms_messages
        SET status = 'QUEUED', error_code = $2,
            next_attempt_at = now() + ($3::int * INTERVAL '1 second'), updated_at = now()
      WHERE id = $1`,
    [row.id, res.error ?? "SMS_FAILED", delay],
  );
  logger.warn("sms: retry scheduled", {
    storeId: row.store_id,
    to: maskPhone(row.to_phone),
    error: res.error,
    attempts,
    delaySeconds: delay,
  });
}

/**
 * Sends everything that is due. Called by the sweeper; returns how many rows
 * it picked up.
 */
export async function drainSmsQueue(batchSize = 20): Promise<number> {
  // Recover rows left in SENDING by a crash/restart. Their attempt was already
  // counted when they were claimed.
  await q(
    `UPDATE sms_messages
        SET status = 'QUEUED', updated_at = now()
      WHERE status = 'SENDING'
        AND updated_at < now() - ($1::int * INTERVAL '1 minute')
        AND attempts < $2`,
    [STALE_SENDING_MINUTES, MAX_ATTEMPTS],
  );

  const rows = await q<{ id: string }>(
    `SELECT id FROM sms_messages
      WHERE status = 'QUEUED'
        AND attempts < $1
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      ORDER BY created_at ASC
      LIMIT $2`,
    [MAX_ATTEMPTS, batchSize],
  );

  for (const row of rows) {
    try {
      await deliverSmsRow(row.id);
    } catch (err) {
      logger.error("sms: sweep failed for message", { id: row.id, error: String(err) });
    }
  }

  return rows.length;
}

/**
 * Starts the background queue sweeper. Returns a stop function for graceful
 * shutdown. `unref()` keeps the timer from holding the process open in tests.
 */
export function startSmsSweeper(intervalMs = 120_000): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const drained = await drainSmsQueue();
      if (drained > 0) logger.info("sms: sweeper drained", { count: drained });
    } catch (err) {
      // A failing sweep must never take the API down.
      logger.warn("sms: sweeper failed", { error: String(err) });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  void tick();

  return () => clearInterval(timer);
}
