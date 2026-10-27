-- ============================================================
-- 025_sms_device_delivery.sql
-- The phone can now send the udhaari SMS from its own SIM
-- (SMS_MODE=device). Such a message is reported back as SENT,
-- FAILED, or HANDED_OFF (the app opened the SMS composer and
-- the user may still press send), so the status constraint
-- needs the new terminal state.
-- ============================================================

ALTER TABLE sms_messages
  DROP CONSTRAINT IF EXISTS sms_messages_status_check;

ALTER TABLE sms_messages
  ADD CONSTRAINT sms_messages_status_check CHECK (status IN (
    'QUEUED', 'SENDING', 'SENT', 'FAILED', 'HANDED_OFF',
    'SKIPPED_QUOTA', 'SKIPPED_NO_MOBILE', 'SKIPPED_OPT_OUT', 'SKIPPED_DISABLED'
  ));

-- Device rows are selected by the sweeper only to expire abandoned ones.
CREATE INDEX IF NOT EXISTS idx_sms_messages_device_pending
  ON sms_messages (updated_at)
  WHERE status IN ('QUEUED', 'SENDING') AND provider = 'device';
