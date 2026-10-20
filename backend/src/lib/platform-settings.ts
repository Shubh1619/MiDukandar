import { q } from "../db/pool.js";
import { logger } from "./logger.js";

/**
 * Reads the platform-wide switches the superadmin console writes into
 * `platform_settings` (migration 006). Before this module those rows were
 * stored and never consulted, so toggling maintenance mode, signup, SMTP or the
 * default OTP policy in the console had no observable effect.
 *
 * The table is tiny and changes rarely, so reads are cached for a short window
 * (`CACHE_TTL_MS`) to keep `authenticate` from issuing a query on every
 * request while still picking up a change within seconds.
 */

export interface PlatformSettings {
  maintenance_mode: boolean;
  signup_enabled: boolean;
  smtp_paused: boolean;
  default_otp_expiry_minutes: number | null;
  default_otp_length: number | null;
}

const DEFAULTS: PlatformSettings = {
  maintenance_mode: false,
  signup_enabled: true,
  smtp_paused: false,
  default_otp_expiry_minutes: null,
  default_otp_length: null,
};

const CACHE_TTL_MS = 5_000;
const CACHE = { at: 0, value: DEFAULTS };

function coerce(raw: Record<string, unknown>): PlatformSettings {
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    maintenance_mode: bool(raw.maintenance_mode, DEFAULTS.maintenance_mode),
    signup_enabled: bool(raw.signup_enabled, DEFAULTS.signup_enabled),
    smtp_paused: bool(raw.smtp_paused, DEFAULTS.smtp_paused),
    default_otp_expiry_minutes: num(raw.default_otp_expiry_minutes),
    default_otp_length: num(raw.default_otp_length),
  };
}

/** Loads platform settings, serving a cached copy for `CACHE_TTL_MS`. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const now = Date.now();
  if (now - CACHE.at < CACHE_TTL_MS) return CACHE.value;
  try {
    const rows = await q<{ key: string; value: unknown }>(`SELECT key, value FROM platform_settings`);
    const raw: Record<string, unknown> = {};
    for (const r of rows) raw[r.key] = r.value;
    CACHE.value = coerce(raw);
    CACHE.at = now;
  } catch (err) {
    // Never let a settings read take the API down: fall back to the last known
    // (or default) values and retry on the next call.
    logger.warn("platform-settings: read failed, using cached defaults", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return CACHE.value;
}

/** Clears the cache so the next read reflects a just-applied update. */
export function invalidatePlatformSettings(): void {
  CACHE.at = 0;
}
