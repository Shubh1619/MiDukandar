import { fetch, EnvHttpProxyAgent } from "undici";
import { config } from "../config.js";
import { logger, maskEmail } from "./logger.js";

const BREVO_API = "https://api.brevo.com/v3";

const dispatcher =
  process.env.HTTPS_PROXY || process.env.QUOTAGUARDSTATIC_URL
    ? new EnvHttpProxyAgent()
    : undefined;

export interface MailRecipient {
  email: string;
  name?: string;
}

export interface SendMailInput {
  to: string | MailRecipient | Array<string | MailRecipient>;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  ok: boolean;
  mode: "log" | "brevo";
  messageId?: string;
  error?: string;
  status?: number;
  body?: string;
}

function normalizeRecipients(to: SendMailInput["to"]): MailRecipient[] {
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
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
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
    logger.info("mail:log", { to: maskedToList, subject: input.subject });
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
        to: maskedToList,
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

    const json = (await res.json()) as { messageId?: string };
    logger.info("brevo: email sent", { to: maskedToList, subject: input.subject, messageId: json.messageId });
    return { ok: true, mode: "brevo", messageId: json.messageId };
  } catch (err) {
    logger.error("brevo: email send exception", {
      error: String(err),
      to: maskedToList,
      subject: input.subject,
    });
    return { ok: false, mode: "brevo", error: "BREVO_NETWORK_ERROR" };
  }
}

export function renderOtpEmail(otp: string, appName: string, expiryMinutes: number): string {
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
