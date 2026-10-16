-- Refer-a-friend program: each store gets a shareable referral code; a newly
-- registered store may record which store referred it.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- Backfill codes for stores created before this migration.
UPDATE stores
SET referral_code = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL OR referral_code = '';

-- Auto-generate a code for future inserts.
ALTER TABLE stores
  ALTER COLUMN referral_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

ALTER TABLE stores
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_referral_code ON stores(referral_code);
CREATE INDEX IF NOT EXISTS idx_stores_referred_by ON stores(referred_by_store_id);
