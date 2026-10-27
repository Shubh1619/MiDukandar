import { fetch, EnvHttpProxyAgent } from "undici";
import { config, type SmsMode } from "../config.js";
import { logger, maskPhone } from "./logger.js";
import { nationalMobile } from "./phone.js";
import { getPlatformSettings } from "./platform-settings.js";
import { smsSegments } from "./sms-template.js";

/**
 * SMS gateway adapters.
 *
 * Mirrors lib/mail.ts:
 * - `log` never contacts a gateway and prints the message to the console, so
 *   the whole flow is testable offline.
 * - The real adapters send over undici (same proxy support as email) with a
 *   hard timeout, and log only the HTTP status / provider error code — never
 *   the phone number or the message body.
 */

const MSG91_SMS_API = "https://control.msg91.com/api/v5/flow";
const FAST2SMS_API = "https://www.fast2sms.com/dev/bulkV2";

const dispatcher =
  process.env.HTTPS_PROXY || process.env.QUOTAGUARDSTATIC_URL
    ? new EnvHttpProxyAgent()
    : undefined;

export interface SendSmsInput {
  /** E.164 (`+91XXXXXXXXXX`). */
  to: string;
  /** Fully rendered message (audit copy). */
  body: string;
  /** DLT template with `{#var#}` placeholders. */
  templateBody: string;
  /** Values for the placeholders, in template order. */
  variables: string[];
}

export interface SendSmsResult {
  ok: boolean;
  mode: SmsMode;
  providerMessageId?: string;
  error?: string;
  status?: number;
  /**
   * True when retrying cannot help (bad template, invalid number, paused
   * platform, 4xx). The caller then marks the message FAILED immediately.
   */
  permanent?: boolean;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const masked = maskPhone(input.to);

  if (config.smsMode === "log") {
    const block = [
      "",
      "──────────────────────────────────────────────",
      " SMS (SMS_MODE=log) — NOT SENT",
      ` To:   ${input.to}`,
      ` Body: ${input.body}`,
      "──────────────────────────────────────────────",
      "",
    ].join("\n");
    process.stdout.write(`${block}\n`);
    logger.info("sms:log", { to: masked, segments: smsSegments(input.body) });
    return { ok: true, mode: "log" };
  }

  // Device mode is delivered by the mobile app from the phone's own SIM. The
  // API must never fall through to a gateway adapter here: doing so would send
  // the message twice and bill a provider the deployment did not configure.
  if (config.smsMode === "device") {
    logger.warn("sms: device mode has no server-side sender", { to: masked });
    return { ok: false, mode: "device", error: "SMS_DEVICE_MODE", permanent: true };
  }

  try {
    // Superadmin kill-switch for outbound SMS (provider outage, suspected
    // abuse). Checked only for the real-send path so local log mode is
    // unaffected. A failure here is permanent — retrying while paused would
    // just burn attempts.
    if ((await getPlatformSettings()).sms_paused) {
      logger.warn("sms: paused by platform setting", { to: masked });
      return { ok: false, mode: config.smsMode, error: "sms_paused", permanent: true };
    }

    if (config.smsMode === "msg91") return await sendViaMsg91(input, masked);
    return await sendViaFast2Sms(input, masked);
  } catch (err) {
    // No phone number or body in this line — same PII rule as email.
    logger.error("sms: send exception", {
      provider: config.smsMode,
      error: String(err),
    });
    return { ok: false, mode: config.smsMode, error: "SMS_NETWORK_ERROR" };
  }
}

async function sendViaMsg91(input: SendSmsInput, masked: string): Promise<SendSmsResult> {
  // MSG91's flow API takes the template ID plus the values for its numbered
  // variables (VAR1…VARn), not a rendered message. DLT `{#var#}` placeholders
  // map 1:1 to VAR1, VAR2, … in registration order.
  const recipient: Record<string, string> = {
    mobiles: input.to.replace(/\D/g, ""),
  };
  input.variables.forEach((value, index) => {
    recipient[`VAR${index + 1}`] = value;
  });

  const res = await fetch(MSG91_SMS_API, {
    method: "POST",
    headers: {
      authkey: config.smsApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      template_id: config.smsDltTemplateId,
      recipients: [recipient],
    }),
    signal: AbortSignal.timeout(config.smsTimeoutMs),
    ...(dispatcher ? { dispatcher } : {}),
  });

  if (!res.ok) {
    // Status only: the body can echo the recipient number.
    logger.error("msg91: failed to send sms", { status: res.status, to: masked });
    return {
      ok: false,
      mode: "msg91",
      error: `MSG91_HTTP_${res.status}`,
      status: res.status,
      permanent: res.status >= 400 && res.status < 500 && res.status !== 429,
    };
  }

  let requestId: string | undefined;
  let providerError: string | undefined;
  try {
    // Flow API answers `{ message, type }`; `type: "error"` means rejected.
    const json = (await res.json()) as { message?: unknown; type?: unknown };
    if (typeof json.message === "string") requestId = json.message;
    if (typeof json.type === "string" && json.type.toLowerCase() === "error") {
      providerError = "MSG91_REJECTED";
    }
  } catch {
    /* 200 with a non-JSON body: accepted is the only safe assumption */
  }

  if (providerError) {
    logger.error("msg91: rejected sms", { to: masked });
    return { ok: false, mode: "msg91", error: providerError, status: res.status, permanent: true };
  }

  logger.info("msg91: accepted", { to: masked, messageId: requestId });
  return { ok: true, mode: "msg91", providerMessageId: requestId };
}

async function sendViaFast2Sms(input: SendSmsInput, masked: string): Promise<SendSmsResult> {
  const res = await fetch(FAST2SMS_API, {
    method: "POST",
    headers: {
      authorization: config.smsApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      route: "dlt",
      sender_id: config.smsSenderId,
      // Fast2SMS expects the DLT-approved *message id* here, not the template
      // text; it substitutes `variables_values` into the registered template.
      // Sent as a string to avoid losing precision on long numeric ids.
      message: String(config.smsDltTemplateId),
      variables_values: input.variables.join("|"),
      numbers: nationalMobile(input.to),
      flash: 0,
    }),
    signal: AbortSignal.timeout(config.smsTimeoutMs),
    ...(dispatcher ? { dispatcher } : {}),
  });

  if (!res.ok) {
    logger.error("fast2sms: failed to send sms", { status: res.status, to: masked });
    return {
      ok: false,
      mode: "fast2sms",
      error: `FAST2SMS_HTTP_${res.status}`,
      status: res.status,
      permanent: res.status >= 400 && res.status < 500 && res.status !== 429,
    };
  }

  let requestId: string | undefined;
  let rejected = false;
  try {
    // Fast2SMS answers 200 with `{return: false}` for a rejected request.
    const json = (await res.json()) as { return?: unknown; request_id?: unknown };
    rejected = json.return === false;
    if (typeof json.request_id === "string") requestId = json.request_id;
  } catch {
    /* non-JSON 200: treat as accepted */
  }

  if (rejected) {
    logger.error("fast2sms: rejected sms", { to: masked });
    return { ok: false, mode: "fast2sms", error: "FAST2SMS_REJECTED", status: res.status, permanent: true };
  }

  logger.info("fast2sms: accepted", { to: masked, messageId: requestId });
  return { ok: true, mode: "fast2sms", providerMessageId: requestId };
}
