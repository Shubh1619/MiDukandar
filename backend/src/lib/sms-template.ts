import { money } from "./money.js";

/**
 * SMS templates.
 *
 * Every message sent to an Indian number must match a DLT-registered
 * template byte for byte, with the same number of `{#var#}` placeholders in
 * the same order. The constant body below is the text to register with the
 * provider / DLT portal; `renderUdhaariCreatedSms` fills it in for the audit
 * log and for gateways that accept a fully rendered message.
 */

export const UDHAARI_TEMPLATE_KEY = "UDHAARI_CREATED";

/** Register this exact text (4 variables) with the DLT portal. */
export const UDHAARI_TEMPLATE_BODY =
  "Dear {#var#}, Rs.{#var#} udhaari added at {#var#}. Outstanding: Rs.{#var#}. - MiDukandar";

/** Single GSM-7 segment. Longer bodies cost more credits and can be split. */
export const GSM_SEGMENT_LIMIT = 160;
/** Single UCS-2 (Unicode) segment — Hindi/Marathi names push the body here. */
export const UCS2_SEGMENT_LIMIT = 70;

export interface UdhaariSmsContent {
  /** Fixed text with `{#var#}` placeholders, as registered with DLT. */
  templateBody: string;
  /** Values for the placeholders, in order. */
  variables: string[];
  /** The message that was actually sent (for the audit log). */
  body: string;
  /** Number of SMS segments the body occupies (1 credit per segment). */
  segments: number;
}

export interface UdhaariSmsInput {
  customerName: string;
  shopName: string;
  amount: unknown;
  outstanding: unknown;
}

function clamp(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  // Truncate rather than append an ellipsis: a non-ASCII "…" would push an
  // otherwise plain-ASCII message into UCS-2, halving the per-segment limit.
  return clean.length <= max ? clean : clean.slice(0, max).trimEnd();
}

/** `1250` → `1250`, `1250.5` → `1250.50`; never scientific notation. */
export function formatSmsAmount(value: unknown): string {
  const rounded = money(value);
  return rounded.isInteger() ? rounded.toFixed(0) : rounded.toFixed(2);
}

/**
 * GSM-7 vs UCS-2. The template body is ASCII, but a customer or shop name
 * may contain Devanagari or another non-Latin script, which forces the whole
 * message into UCS-2 (70 chars per segment instead of 160).
 */
export function isGsm7(body: string): boolean {
  return /^[\x00-\x7F]*$/.test(body);
}

export function smsSegments(body: string): number {
  if (!body) return 0;
  const limit = isGsm7(body) ? GSM_SEGMENT_LIMIT : UCS2_SEGMENT_LIMIT;
  return Math.max(1, Math.ceil(body.length / limit));
}

export function renderUdhaariCreatedSms(input: UdhaariSmsInput): UdhaariSmsContent {
  const variables = [
    clamp(input.customerName || "Customer", 24),
    clamp(formatSmsAmount(input.amount), 12),
    clamp(input.shopName || "your shop", 28),
    clamp(formatSmsAmount(input.outstanding), 12),
  ];

  let body = UDHAARI_TEMPLATE_BODY;
  for (const value of variables) {
    body = body.replace("{#var#}", value);
  }

  return {
    templateBody: UDHAARI_TEMPLATE_BODY,
    variables,
    body,
    segments: smsSegments(body),
  };
}
