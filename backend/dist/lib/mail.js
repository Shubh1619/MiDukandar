import { fetch, EnvHttpProxyAgent } from "undici";
import { config } from "../config.js";
import { logger } from "./logger.js";
const BREVO_API = "https://api.brevo.com/v3";
const dispatcher = process.env.HTTPS_PROXY || process.env.QUOTAGUARDSTATIC_URL
    ? new EnvHttpProxyAgent()
    : undefined;
function normalizeRecipients(to) {
    const list = Array.isArray(to) ? to : [to];
    return list.map((r) => (typeof r === "string" ? { email: r } : r));
}
/**
 * Sends a transactional email.
 *
 * - `MAIL_MODE=log` (local development): never contacts Brevo. The whole
 *   message — including any OTP — is written to the console so the flow is
 *   fully testable offline.
 * - `MAIL_MODE=brevo` (Render/production): posts to the Brevo transaction
 *   REST API. Every failure is logged in full (status + response body) and
 *   returned to the caller; errors are never swallowed silently.
 *
 * The mode and the Brevo credentials are validated at boot in config.ts, so
 * this function can assume a valid configuration for the active mode.
 */
export async function sendMail(input) {
    const recipients = normalizeRecipients(input.to);
    const toList = recipients.map((r) => r.email).join(", ");
    if (config.mailMode === "log") {
        const block = [
            "",
            "──────────────────────────────────────────────",
            " MAIL (MAIL_MODE=log) — NOT SENT",
            ` To:      ${toList}`,
            ` Subject: ${input.subject}`,
            input.text ? ` Text:    ${input.text}` : "",
            " HTML:",
            input.html,
            "──────────────────────────────────────────────",
            "",
        ]
            .filter((line) => line !== "")
            .join("\n");
        process.stdout.write(`${block}\n`);
        logger.info("mail:log", { to: toList, subject: input.subject });
        return { ok: true, mode: "log" };
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
                to: recipients,
                subject: input.subject,
                htmlContent: input.html,
                ...(input.text ? { textContent: input.text } : {}),
            }),
            ...(dispatcher ? { dispatcher } : {}),
        });
        if (!res.ok) {
            const body = await res.text();
            logger.error("brevo: failed to send email", {
                status: res.status,
                body,
                to: toList,
                subject: input.subject,
            });
            return {
                ok: false,
                mode: "brevo",
                error: `BREVO_HTTP_${res.status}`,
                status: res.status,
                body,
            };
        }
        const json = (await res.json());
        logger.info("brevo: email sent", { to: toList, subject: input.subject, messageId: json.messageId });
        return { ok: true, mode: "brevo", messageId: json.messageId };
    }
    catch (err) {
        logger.error("brevo: email send exception", {
            error: String(err),
            to: toList,
            subject: input.subject,
        });
        return { ok: false, mode: "brevo", error: "BREVO_NETWORK_ERROR" };
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
