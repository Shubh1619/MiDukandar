/**
 * Indian mobile number normalization.
 *
 * `customers.mobile` is free text (max 20 chars) and has been filled in by
 * shopkeepers in every shape: `9876543210`, `+91 98765 43210`,
 * `09876543210`, `919876543210`, sometimes with dashes. An SMS gateway
 * rejects anything that is not a bare 10-digit national number (or a
 * country-code-prefixed one), so every number is normalized to E.164
 * (`+91XXXXXXXXXX`) before it is stored on an SMS record or sent.
 *
 * Validation is deliberately strict: only Indian mobile numbers (10 digits
 * starting 6–9) are accepted. Landlines and short numbers cannot receive
 * transactional SMS and are treated the same as a missing number.
 */

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Returns `+91XXXXXXXXXX` for a plausible Indian mobile number, or `null`
 * when the input cannot be a mobile (empty, too short/long, landline, or
 * contains no digits).
 */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Remove formatting: spaces, dashes, brackets, a leading "+" and any
  // extension text. Everything that is not a digit is noise here.
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // `0091...`, `091...`, `0...` — strip the international/trunk prefix.
  digits = digits.replace(/^0+/, "");
  // `91` + a redundant trunk `0` (+91 (0) 98765 43210).
  if (digits.length === 13 && digits.startsWith("910")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);

  if (!INDIAN_MOBILE.test(digits)) return null;
  return `+91${digits}`;
}

/** `+919876543210` → `9876543210` (what SMS gateways expect in `to`). */
export function nationalMobile(e164: string): string {
  return e164.replace(/\D/g, "").slice(-10);
}
