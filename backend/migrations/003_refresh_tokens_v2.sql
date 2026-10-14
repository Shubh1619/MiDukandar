-- ============================================================
-- 003_refresh_tokens_v2.sql
-- Refresh tokens v2: hash-only storage, device info, sliding
-- expiry, last-used tracking. Raw tokens are never persisted.
-- ============================================================

-- ---------- new columns ----------
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS device_info TEXT,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Backfill hashes from any tokens created before this migration
-- (sha256 of the raw token bytes — matches Node's crypto hashing).
UPDATE refresh_tokens
   SET token_hash = encode(sha256(token::bytea), 'hex')
 WHERE token_hash IS NULL;

ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL;

-- ---------- indexes ----------
CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_hash
  ON refresh_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
  ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
  ON refresh_tokens(user_id, revoked);

-- ---------- stop storing raw tokens ----------
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS token;