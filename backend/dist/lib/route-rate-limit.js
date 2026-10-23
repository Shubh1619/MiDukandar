/**
 * Per-route override of the global per-IP limiter registered in app.ts: the
 * endpoint answers 429 sooner than the shared 300/15-minute budget. Only
 * max/timeWindow are replaced — the plugin's global keyGenerator (socket
 * anchored, see lib/rate-limit-key.ts) still applies, and @fastify/rate-limit
 * keeps a separate counter per merged parameter set, so these routes no longer
 * share the caller's global bucket.
 *
 * Use it on endpoints that are unauthenticated and cheap to abuse: identity
 * probes, OTP delivery and guessing, account creation, PIN reset.
 */
export function rateLimited(max, timeWindow) {
    return { config: { rateLimit: { max, timeWindow } } };
}
