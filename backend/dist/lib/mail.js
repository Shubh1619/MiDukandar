import { fetch, EnvHttpProxyAgent } from "undici";
import { config } from "../config.js";
import { logger } from "./logger.js";
const BREVO_API = "https://api.brevo.com/v3";
const dispatcher = process.env.HTTPS_PROXY || process.env.QUOTAGUARDSTATIC_URL
    ? new EnvHttpProxyAgent()
    : undefined;
/**
 * Sends a transactional email via Brevo REST API. Falls back to a local
 * "no-op" in development when BREVO_API_KEY is not configured, so OTP flows
 * are still testable locally (OTP is logged + caller can capture it).
 */
export async function sendEmail(input) {
    if (!config.brevoApiKey) {
        logger.warn("brevo: BREVO_API_KEY not set - skipping email send", {
            to: input.to.map((t) => t.email).join(","),
            subject: input.subject,
        });
        return { ok: false, error: "BREVO_API_KEY_NOT_CONFIGURED" };
    }
    try {
        const res = await fetch(`${BREVO_API}/smtp/email`, {
            method: "POST",
            headers: {
                "api-key": config.brevoApiKey,
                "content-type": "application/json",
                accept: "application/json",
            },
            body: JSON.stringify({
                sender: { email: config.brevoSenderEmail, name: config.brevoSenderName },
                to: input.to,
                subject: input.subject,
                htmlContent: input.html,
                ...(input.text ? { textContent: input.text } : {}),
            }),
            ...(dispatcher ? { dispatcher } : {}),
        });
        if (!res.ok) {
            const body = await res.text();
            logger.error("brevo: failed to send email", { status: res.status, body });
            return { ok: false, error: `BREVO_HTTP_${res.status}` };
        }
        const json = (await res.json());
        return { ok: true, messageId: json.messageId };
    }
    catch (err) {
        logger.error("brevo: email send exception", { error: String(err) });
        return { ok: false, error: "BREVO_NETWORK_ERROR" };
    }
}
export function renderOtpEmail(otp, appName, expiryMinutes) {
    return `
  <div style="font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 28px; font-weight: 800; color: #16a34a;">${appName}</span>
    </div>
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
      <h2 style="margin-top: 0; color: #111827;">Your OTP code</h2>
      <p style="color: #4b5563; font-size: 15px;">Use this one-time password to sign in to ${appName}. It expires in ${expiryMinutes} minutes.</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #16a34a; background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">${otp}</div>
      <p style="color: #6b7280; font-size: 12px;">If you did not request this code, you can safely ignore this email.</p>
    </div>
  </div>`;
}
