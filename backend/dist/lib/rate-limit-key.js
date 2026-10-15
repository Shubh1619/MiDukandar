/**
 * Socket addresses of hops we are willing to believe an X-Forwarded-For header
 * from: loopback (Next.js proxying /api/* on the same host or container) and
 * RFC1918 ranges (the compose `web` -> `backend` bridge network).
 */
const TRUSTED_PROXY_ADDR = /^(::1|::ffff:127\.|127\.|::ffff:(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
export function isTrustedProxyAddr(addr) {
    return TRUSTED_PROXY_ADDR.test(addr);
}
/**
 * Rate-limit bucket key.
 *
 * Anchored on the TCP peer address, which a client cannot forge. The
 * X-Forwarded-For value (`request.ip`, resolved by Fastify's trustProxy) is
 * only honoured when the request genuinely arrived from a trusted proxy hop —
 * otherwise a direct caller could rotate the header and mint an unlimited
 * number of buckets, defeating both the global limit and the stricter
 * superadmin auth limit.
 *
 * `trustProxy` alone cannot fix this: the API port is published, so a direct
 * connection arrives with a client-supplied header that a hop count of 1 would
 * still trust.
 */
export function rateLimitKey(request) {
    const socketIp = request.socket.remoteAddress ?? "";
    if (socketIp && isTrustedProxyAddr(socketIp)) {
        return request.ip || socketIp;
    }
    return socketIp || "unknown";
}
