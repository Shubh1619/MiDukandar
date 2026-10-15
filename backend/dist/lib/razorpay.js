import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
/**
 * Verifies the `x-razorpay-signature` header against the raw request body.
 *
 * Computes the HMAC locally rather than delegating to
 * Razorpay.validateWebhookSignature, which compares with `===` and therefore
 * leaks timing information. Also rejects an empty secret: HMAC over an empty
 * key is well-defined, so an unset RAZORPAY_WEBHOOK_SECRET would otherwise make
 * every attacker-supplied signature valid.
 */
export function verifyRazorpayWebhookSignature(body, signature) {
    const secret = config.razorpayWebhookSecret;
    if (!secret || !body || !signature)
        return false;
    const expected = createHmac("sha256", secret).update(body).digest();
    const given = Buffer.from(signature, "hex");
    if (given.length !== expected.length)
        return false;
    return timingSafeEqual(given, expected);
}
