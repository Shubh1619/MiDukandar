import type { FastifyInstance, FastifyRequest } from "fastify";
import { verifyRazorpayWebhookSignature, type RazorpayPayload } from "../lib/razorpay.js";
import { logger } from "../lib/logger.js";
import { pool } from "../db/pool.js";

function rawBody(request: FastifyRequest): string {
  return String((request as import("fastify").FastifyRequest & { rawBody?: Buffer }).rawBody?.toString() ?? "");
}

export async function webhookRoutes(app: FastifyInstance) {
  // Ensures each (event, entity_id) is processed at most once.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      processed_at TIMESTAMPTZ DEFAULT now(),
      payload JSONB
    )
  `);

  async function isProcessed(eventId: string, entityId: string): Promise<boolean> {
    const { rows } = await pool.query<{ processed_at: string }[], [string, string]>(
      `SELECT 1 FROM webhook_events WHERE event_id = $1 AND payload->>'entity_id' = $2 LIMIT 1`,
      [eventId, entityId],
    );
    return rows.length > 0;
  }

  async function markProcessed(eventId: string, entityId: string): Promise<void> {
    await pool.query(
      `INSERT INTO webhook_events (event_id, payload) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
      [eventId, JSON.stringify({ entity_id: entityId })],
    );
  }

  // Razorpay payment webhook (UPI QR scans resolve here).
  app.post("/razorpay", async (request, reply) => {
    const body = rawBody(request);
    const signature = String(request.headers["x-razorpay-signature"] ?? "");

    if (!verifyRazorpayWebhookSignature(body, signature)) {
      return reply.status(400).send({ error: "Invalid signature" });
    }

    const payload = request.body as RazorpayPayload;
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