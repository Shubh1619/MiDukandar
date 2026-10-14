-- ============================================================
-- 012_refresh_tokens_grace.sql
-- Refresh-token rotation grace window.
--
-- The refresh endpoint ROTATES the token on every use (revoke old, issue
-- new). When two requests present the same cookie at the same time (two
-- browser tabs refreshing concurrently, or a mobile retry after a timed-out
-- first attempt), the loser would be rejected as `token_revoked` AND its
-- response would clear the cookie — wiping the winner's fresh token and
-- logging the user out mid-session. That's the "silent logout / 401 loop"
-- bug.
--
-- Fix: when a token is revoked by a ROTATION, give it a short grace_until
-- window. A refresh that presents the (just-rotated) token within that
-- window rotates again instead of rejecting. Explicit logouts and the
-- recovery/PIN-reset flow revoke WITHOUT setting grace_until, so those stay
-- immediate.
-- ============================================================

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;