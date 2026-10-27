-- ============================================================
-- 024_sms_notifications.sql
-- Transactional SMS to customers when a udhaari (credit) entry is
-- created. Each store gets a daily free allowance (default 100) that
-- resets at 00:00 IST; `sms_usage_daily` is the counter and
-- `sms_messages` is the audit/outbox log.
-- ============================================================

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS sms_udhaari_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_daily_limit INTEGER NOT NULL DEFAULT 100;

-- Keep the allowance sane: 0 disables SMS for the store, and the upper
-- bound stops a typo from turning the daily free cap into a blank cheque.
ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_sms_daily_limit_range;
ALTER TABLE stores
  ADD CONSTRAINT stores_sms_daily_limit_range
  CHECK (sms_daily_limit >= 0 AND sms_daily_limit <= 1000);

-- Customers can ask not to be texted; honoured before every send.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- One row per store per IST calendar day. The send path increments this
-- with a single conditional upsert, so two concurrent udhaari entries can
-- never exceed the allowance.
CREATE TABLE IF NOT EXISTS sms_usage_daily (
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, day)
);

-- Audit trail + outbox. `QUEUED` rows with a due `next_attempt_at` are
-- re-driven by the sweeper in services/sms.service.ts.
CREATE TABLE IF NOT EXISTS sms_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  reference_type      TEXT NOT NULL,
  reference_id        UUID,
  to_phone            TEXT NOT NULL,
  template_key        TEXT NOT NULL,
  template_body       TEXT NOT NULL,
  variables           JSONB NOT NULL DEFAULT '[]'::jsonb,
  body                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'QUEUED',
  provider            TEXT,
  provider_message_id TEXT,
  error_code          TEXT,
  attempts            INTEGER NOT NULL DEFAULT 0,
  quota_day           DATE,
  quota_reserved      BOOLEAN NOT NULL DEFAULT FALSE,
  next_attempt_at     TIMESTAMPTZ,
  created_by_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sms_messages_status_check CHECK (status IN (
    'QUEUED', 'SENDING', 'SENT', 'FAILED',
    'SKIPPED_QUOTA', 'SKIPPED_NO_MOBILE', 'SKIPPED_OPT_OUT', 'SKIPPED_DISABLED'
  ))
);

-- Exactly one SMS record per source row: a retried request or a second
-- notify call for the same udhaari entry cannot send twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_messages_reference
  ON sms_messages (store_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_store_created
  ON sms_messages (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_messages_retry
  ON sms_messages (next_attempt_at)
  WHERE status = 'QUEUED';
