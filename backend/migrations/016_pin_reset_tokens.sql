-- ============================================================
-- MiDukandar - 016_pin_reset_tokens.sql
-- One-time (single-use) PIN-reset tokens.
--
-- P2-10: the token issued by POST /api/auth/recovery/verify-otp is a short
-- lived JWT. Nothing used to record it as spent, so a captured token could
-- reset the PIN repeatedly for its whole 10-minute life. The `jti` claim is
-- now persisted here at issue time and marked consumed in the same
-- transaction that writes the new PIN, which makes a replay a hard no-op.
-- ============================================================

CREATE TABLE IF NOT EXISTS pin_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jti         TEXT NOT NULL UNIQUE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pin_reset_tokens_user
  ON pin_reset_tokens(user_id, expires_at DESC);
