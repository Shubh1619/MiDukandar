-- ============================================================
-- MiDukandar - 004_recovery.sql
-- PIN recovery / forgot-pin flow support.
-- ============================================================

-- Holds the PIN hash (bcrypt) for terminal-unlock credentials managed
-- outside the access/refresh JWT lifecycle.
ALTER TABLE users ADD COLUMN pin_hash TEXT;

-- Extend OTP purposes to cover the recovery flow instead of reusing LOGIN
-- (avoids a pending login OTP colliding with a recovery OTP on the same email).
ALTER TABLE otps DROP CONSTRAINT otps_purpose_check;
ALTER TABLE otps ADD CONSTRAINT otps_purpose_check
  CHECK (purpose IN ('LOGIN','REGISTER','RECOVERY'));

-- Audit trail for sensitive account actions (PIN resets, future staff ops).
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id   UUID REFERENCES stores(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  detail     JSONB NOT NULL DEFAULT '{}',
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_store ON audit_logs(store_id, created_at DESC);