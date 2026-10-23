import crypto from "node:crypto";
import { verifyRazorpayWebhookSignature } from "../lib/razorpay.js";
import { logger, maskEmail } from "../lib/logger.js";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
function rawBody(request) {
    return String(request.rawBody?.toString() ?? "");
}
// Only the events that mean a login code never reached the recipient are worth
// an operator's attention; "delivered"/"opened"/"click"/"request" are noise
// here. Brevo sends the event name in `event`.
const BREVO_FAILURE_EVENTS = new Set(["blocked", "hardBounce", "softBounce", "spam", "unsubscribed"]);
// Constant-time comparison so a caller cannot recover the configured secret by
// timing the endpoint. A length mismatch returns early (length is not secret).
function secretsMatch(presented, expected) {
    const a = Buffer.from(presented, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length)
        return false;
    return crypto.timingSafeEqual(a, b);
}
// The secret is accepted as a header (Brevo supports custom webhook headers) or
// as a `?token=` query parameter, whichever the configured webhook uses.
function presentedSecret(request) {
    const header = request.headers["x-brevo-webhook-secret"];
    if (typeof header === "string" && header)
        return header;
    const token = request.query?.token;
    return typeof token === "string" ? token : "";
}
export async function isProcessed(eventId, entityId) {
    const { rows } = await pool.query(`SELECT 1 FROM webhook_events WHERE event_id = $1 AND entity_id = $2 LIMIT 1`, [eventId, entityId]);
    return rows.length > 0;
}
export async function markProcessed(eventId, entityId) {
    await pool.query(`INSERT INTO webhook_events (event_id, entity_id, payload) VALUES ($1, $2, $3) ON CONFLICT (event_id, entity_id) DO NOTHING`, [eventId, entityId, JSON.stringify({ entity_id: entityId })]);
}
export async function webhookRoutes(app) {
    // Ensures each (event, entity_id) is processed at most once (P2-04).
    await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id     TEXT NOT NULL,
      entity_id    TEXT NOT NULL,
      processed_at TIMESTAMPTZ DEFAULT now(),
      payload      JSONB,
      PRIMARY KEY (event_id, entity_id)
    )
  `);
    // Razorpay payment webhook (UPI QR scans resolve here).
    app.post("/razorpay", async (request, reply) => {
        const body = rawBody(request);
        const signature = String(request.headers["x-razorpay-signature"] ?? "");
        if (!verifyRazorpayWebhookSignature(body, signature)) {
            return reply.status(400).send({ error: "Invalid signature" });
        }
        const payload = request.body;
        const eventId = payload.event;
        const entityId = (payload.payload?.payment?.entity?.id ?? "").toString();
        if (eventId && entityId && await isProcessed(eventId, entityId)) {
            logger.info("webhook: duplicate event skipped", { event: eventId, entity_id: entityId });
            return reply.send({ ok: true, skipped: true });
        }
        if (eventId && entityId) {
            await markProcessed(eventId, entityId);
        }
        logger.info("webhook: razorpay event", { event: payload.event });
        if (payload.event === "payment.captured") {
            const entity = payload.payload.payment.entity;
            const notes = entity.notes ?? {};
            logger.info("payment: captured %s", { amount: entity.amount, notes });
            // Full matching (payment link → sale) lands with the mobile client's
            // local payment record; server keeps webhook history in logs for audit.
        }
        return reply.send({ ok: true });
    });
    // Razorpay payment link validation ping
    app.post("/razorpay/validate", async (request, reply) => {
        const body = rawBody(request);
        const signature = String(request.headers["x-razorpay-signature"] ?? "");
        if (!verifyRazorpayWebhookSignature(body, signature)) {
            return reply.status(400).send({ error: "Invalid signature" });
        }
        return reply.send({ ok: true });
    });
    // Brevo delivery events (blocked, hard bounce, soft bounce, spam, unsubscribe).
    // This is a diagnostic sink: it records why an OTP email did not reach the
    // user. It performs no writes, so replaying the same delivery is harmless —
    // the handler is idempotent. The recipient is masked and the code never
    // appears (the event carries neither the subject nor the body).
    app.post("/brevo", async (request, reply) => {
        const expected = config.brevoWebhookSecret;
        if (!expected || !secretsMatch(presentedSecret(request), expected)) {
            logger.warn("brevo: webhook rejected", {
                reason: expected ? "bad_secret" : "not_configured",
            });
            return reply.status(401).send({ error: "Invalid webhook secret" });
        }
        const payload = request.body;
        const events = Array.isArray(payload) ? payload : [payload];
        for (const ev of events) {
            const event = String(ev?.event ?? "");
            if (!BREVO_FAILURE_EVENTS.has(event))
                continue;
            logger.warn("brevo: delivery failed", {
                event,
                email: maskEmail(ev?.email),
                reason: ev?.reason,
                messageId: ev?.["message-id"] ?? ev?.messageId,
            });
        }
        return reply.send({ ok: true });
    });
}
