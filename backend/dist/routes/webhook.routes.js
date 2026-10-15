import { verifyRazorpayWebhookSignature } from "../lib/razorpay.js";
import { logger } from "../lib/logger.js";
import { sendPushNotification } from "../lib/fcm.js";
function rawBody(request) {
    return String(request.rawBody?.toString() ?? "");
}
export async function webhookRoutes(app) {
    // Razorpay payment webhook (UPI QR scans resolve here).
    app.post("/razorpay", async (request, reply) => {
        const body = rawBody(request);
        const signature = String(request.headers["x-razorpay-signature"] ?? "");
        if (!verifyRazorpayWebhookSignature(body, signature)) {
            return reply.status(400).send({ error: "Invalid signature" });
        }
        const payload = request.body;
        logger.info("webhook: razorpay event", { event: payload.event });
        if (payload.event === "payment.captured") {
            const entity = payload.payload.payment.entity;
            const notes = entity.notes ?? {};
            try {
                await sendPushNotification({
                    token: "",
                    title: "Payment received",
                    body: `₹${(entity.amount / 100).toFixed(2)} received via UPI`,
                    data: { referenceId: notes.reference_id },
                });
            }
            catch {
                // push is best-effort
            }
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
