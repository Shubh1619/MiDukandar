import { verifyRazorpayWebhookSignature } from "../lib/razorpay.js";
import { logger } from "../lib/logger.js";
import { pool } from "../db/pool.js";
function rawBody(request) {
    return String(request.rawBody?.toString() ?? "");
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
}
