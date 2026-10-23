/**
 * Loopback peers: 127.0.0.0/8 and ::1. A request whose TCP peer is a loopback
 * address can only have been injected by a process running on this host — in
 * this architecture that is the co-located Next.js proxy of the
 * single-container image, which is the only hop that deployment exposes. A
 * remote client can never appear as the loopback peer.
 */
const LOOPBACK_ADDR = /^(::1|::ffff:127\.|127\.)/;
export function isLoopbackAddr(addr) {
    return LOOPBACK_ADDR.test(addr);
}
/**
 * Rate-limit bucket key.
 *
 * Anchored on the TCP peer address, which a client cannot forge. The
 * X-Forwarded-For value (`request.ip`) is only used when the request arrived
 * through a loopback hop, because Fastify's trust filter (see app.ts) only
 * accepts forwarded entries from a co-located proxy — the one deployment where
 * the header is written by the edge in front of us rather than by the caller.
 *
 * The compose stack proxies from another container over the bridge network, so
 * those requests key on the socket address: the Next proxy forwards the
 * caller's X-Forwarded-For verbatim and did nothing to it, which used to let
 * anyone rotate the header through /api/* for a fresh bucket on every request
 * (defeating the global limit and the stricter superadmin auth limit alike).
 * The same value was also recorded as the client IP in auth and audit logs, so
 * forwarding it also let a caller choose the address an action was attributed
 * to.
 */
export function rateLimitKey(request) {
    const socketIp = request.socket.remoteAddress ?? "";
    if (socketIp && isLoopbackAddr(socketIp)) {
        return request.ip || socketIp;
    }
    return socketIp || "unknown";
}
