-- ============================================================
-- MiDukandar - 017_webhook_events_entity_id.sql
-- Fix webhook idempotency to key on (event_id, entity_id) rather than
-- event_id alone (P2-04). The old schema had PRIMARY KEY(event_id) and
-- stored entity_id only in payload, so distinct entities under the same
-- event name could never be recorded after the first and would be
-- reprocessed on every delivery.
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id   TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  payload    JSONB
);

-- Add the missing entity_id column if the table pre-dates this migration.
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Backfill entity_id from the payload JSONB for any legacy rows.
UPDATE webhook_events
SET entity_id = COALESCE(payload->>'entity_id', '')
WHERE entity_id IS NULL;

-- Ensure entity_id is not null and replace the old primary key with a
-- composite key that captures both event and entity.
ALTER TABLE webhook_events ALTER COLUMN entity_id SET NOT NULL;

ALTER TABLE webhook_events DROP CONSTRAINT IF EXISTS webhook_events_pkey;
ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (event_id, entity_id);
