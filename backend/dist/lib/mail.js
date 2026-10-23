import { fetch, EnvHttpProxyAgent } from "undici";
import { config } from "../config.js";
import { logger, maskEmail } from "./logger.js";
import { getPlatformSettings } from "./platform-settings.js";
const BREVO_API = "https://api.brevo.com/v3";
const dispatcher = process.env.HTTPS_PROXY || process.env.QUOTAGUARDSTATIC_URL
    ? new EnvHttpProxyAgent()
    : undefined;
function normalizeRecipients(to) {
    const list = Array.isArray(to) ? to : [to];
    return list.map((r) => (typeof r === "string" ? { email: r } : r));
}
/**
 * Pulls Brevo's error code out of a JSON error body and discards the body.
 * The body is not logged: it echoes request data (including the recipient
 * address) and dumping it put PII in the log stream. Falls back to the HTTP
 * status when the body is not the JSON shape we expect.
 */
function brevoErrorCode(body, status) {
    try {
        const parsed = JSON.parse(body);
        if (typeof parsed.code === "string" && parsed.code)
            return parsed.code;
    }
    catch {
        /* not JSON */
    }
    return `HTTP_${status}`;
}
/**
 * Sends a transactional email.
 *
 * - `MAIL_MODE=log` (local development): never contacts Brevo. The whole
 *   message — including any OTP — is written to the console so the flow is
 *   fully testable offline.
 * - `MAIL_MODE=brevo` (Render/production): posts to the Brevo transaction
 *   REST API. A failure is logged as the HTTP status plus Brevo's error code
 *   (never the response body, which can echo the recipient) and returned to
 *   the caller; errors are never swallowed silently.
 *
 * The mode and the Brevo credentials are validated at boot in config.ts, so
 * this function can assume a valid configuration for the active mode.
 */
export async function sendMail(input) {
    const recipients = normalizeRecipients(input.to);
    // Recipient addresses are PII: every log line and the local console dump use
    // this masked form. The Brevo request below still sends the real addresses.
    const maskedToList = recipients.map((r) => maskEmail(r.email)).join(", ");
    if (config.mailMode === "log") {
        const block = [
            "",
            "──────────────────────────────────────────────",
            " MAIL (MAIL_MODE=log) — NOT SENT",
            ` To:      ${maskedToList}`,
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
        // The block above is the message body itself (MAIL_MODE=log is a dev-only
        // offline render). The structured log line must not carry the subject: for
        // an OTP that subject is the code.
        logger.info("mail:log", { to: maskedToList });
        return { ok: true, mode: "log" };
    }
    try {
        // Superadmin kill-switch for outbound email (e.g. provider incident or a
        // suspected compromise). Checked only for the real-send path so the dev
        // MAIL_MODE=log flow above is unaffected. Returning ok:false routes into
        // the callers' existing failure handling.
        if ((await getPlatformSettings()).smtp_paused) {
            logger.warn("mail: paused by platform setting", { to: maskedToList });
            return { ok: false, mode: "brevo", error: "smtp_paused" };
        }
        const res = await fetch(`${BREVO_API}/smtp/email`, {
            method: "POST",
            headers: {
                "api-key": config.brevoApiKey,
                "content-type": "application/json",
                accept: "application/json",
            },
            body: JSON.stringify({
                sender: { email: config.mailFromEmail, name: config.mailFromName },
                replyTo: { email: config.mailReplyTo || config.mailFromEmail },
                to: recipients,
                subject: input.subject,
                htmlContent: input.html,
                ...(input.text ? { textContent: input.text } : {}),
                // Transactional send: tagged so it is filterable in Brevo's log and
                // never carries an unsubscribe header (it is not a campaign).
                ...(input.tags?.length ? { tags: input.tags } : {}),
            }),
            ...(dispatcher ? { dispatcher } : {}),
        });
        if (!res.ok) {
            const rawBody = await res.text();
            // Status + code only. The raw body — and the recipient list and subject
            // this line used to carry — can contain the recipient address and other
            // request data, which does not belong in the log stream. The status and
            // Brevo's code are what an operator acts on (e.g. a 401/unauthorized
            // caused by an unauthorised egress IP).
            logger.error("brevo: failed to send email", {
                status: res.status,
                code: brevoErrorCode(rawBody, res.status),
            });
            return {
                ok: false,
                mode: "brevo",
                error: `BREVO_HTTP_${res.status}`,
                status: res.status,
            };
        }
        const json = (await res.json());
        // "accepted": Brevo has queued the message, which is all this API can tell
        // us — final delivery (or a bounce) is reported asynchronously to the
        // Brevo webhook. `subject` is deliberately NOT logged: the OTP subject
        // contains the code. `to` is the masked recipient.
        logger.info("brevo: accepted", { to: maskedToList, messageId: json.messageId });
        return { ok: true, mode: "brevo", messageId: json.messageId };
    }
    catch (err) {
        // No recipient list or subject here either — same PII reason. The caller's
        // "otp: requested" line already records the (masked) address and failure.
        logger.error("brevo: email send exception", { error: String(err) });
        return { ok: false, mode: "brevo", error: "BREVO_NETWORK_ERROR" };
    }
}
/**
 * Builds the login-code email. Kept deliberately plain — no images, no links,
 * no marketing copy — because a bare transactional message is filtered far
 * less aggressively than one padded with remote assets and CTAs. The code
 * appears exactly once in the body (and in the subject); HTML and plain-text
 * parts are both supplied so a client that blocks HTML still shows the code.
 */
export function renderOtpEmail(otp, appName, expiryMinutes) {
    const minutes = `${expiryMinutes} minute${expiryMinutes === 1 ? "" : "s"}`;
    const subject = `${otp} is your ${appName} login code`;
    const text = `${appName} login code: ${otp}\n\n` +
        `It expires in ${minutes}. If you didn't request this code, you can safely ignore this email.`;
    const html = `
  <div style="font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 28px; font-weight: 800; color: #16a34a;">${appName}</span>
    </div>
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
      <h2 style="margin-top: 0; color: #111827;">Your login code</h2>
      <p style="color: #4b5563; font-size: 15px;">Use this code to sign in to ${appName}. It expires in ${minutes}.</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #16a34a; background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">${otp}</div>
      <p style="color: #6b7280; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
    </div>
  </div>`;
    return { subject, html, text };
}
