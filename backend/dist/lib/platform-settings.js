import { q } from "../db/pool.js";
import { logger } from "./logger.js";
const DEFAULTS = {
    maintenance_mode: false,
    signup_enabled: true,
    smtp_paused: false,
    default_otp_expiry_minutes: null,
    default_otp_length: null,
};
const CACHE_TTL_MS = 5_000;
const CACHE = { at: 0, value: DEFAULTS };
function coerce(raw) {
    const bool = (v, d) => (typeof v === "boolean" ? v : d);
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
        maintenance_mode: bool(raw.maintenance_mode, DEFAULTS.maintenance_mode),
        signup_enabled: bool(raw.signup_enabled, DEFAULTS.signup_enabled),
        smtp_paused: bool(raw.smtp_paused, DEFAULTS.smtp_paused),
        default_otp_expiry_minutes: num(raw.default_otp_expiry_minutes),
        default_otp_length: num(raw.default_otp_length),
    };
}
/** Loads platform settings, serving a cached copy for `CACHE_TTL_MS`. */
export async function getPlatformSettings() {
    const now = Date.now();
    if (now - CACHE.at < CACHE_TTL_MS)
        return CACHE.value;
    try {
        const rows = await q(`SELECT key, value FROM platform_settings`);
        const raw = {};
        for (const r of rows)
            raw[r.key] = r.value;
        CACHE.value = coerce(raw);
        CACHE.at = now;
    }
    catch (err) {
        // Never let a settings read take the API down: fall back to the last known
        // (or default) values and retry on the next call.
        logger.warn("platform-settings: read failed, using cached defaults", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    return CACHE.value;
}
/** Clears the cache so the next read reflects a just-applied update. */
export function invalidatePlatformSettings() {
    CACHE.at = 0;
}
