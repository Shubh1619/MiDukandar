-- ============================================================
-- 022_superadmin_refresh_tokens.sql
-- Sliding refresh sessions for the SuperAdmin console.
--
-- The superadmin credential was a single 15-minute access token in an httpOnly
-- cookie with NO refresh path, so the console hard-logged-out every 15 minutes
-- and a reload mid-work lost the session. This mirrors the tenant refresh-token
-- model (hash-only storage, device info, sliding expiry, rotation grace) so the
-- superadmin session survives as long as the refresh token is valid while the
-- browser-facing credential stays a short-lived access token.
--
-- Kept in its OWN table (not refresh_tokens) because super_admin is a fully
-- separate identity table and its tokens must never be accepted by the tenant
-- refresh endpoint (nor vice versa).
-- ============================================================

CREATE TABLE IF NOT EXISTS superadmin_refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  device_info  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  -- Rotation grace: a just-rotated (revoked) token is still accepted within
  -- this window so concurrent console refreshes rotate again instead of being
  -- rejected (matches the tenant refresh_tokens.grace_until contract).
  grace_until  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_superadmin_refresh_tokens_hash
  ON superadmin_refresh_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_superadmin_refresh_tokens_expires
  ON superadmin_refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_superadmin_refresh_tokens_admin_active
  ON superadmin_refresh_tokens(superadmin_id, revoked);
