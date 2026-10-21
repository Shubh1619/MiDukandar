/**
 * Normalises a raw numeric field value typed into a text input:
 *   - non-numeric characters are dropped,
 *   - leading zeros are stripped ("01" → "1", "00.5" → "0.5"), which is the
 *     classic "01" entry bug where typing 0 then 1 stored "01" verbatim,
 *   - only one decimal separator is kept, with at most `decimals` places,
 *   - a lone "." becomes "0." so the user can keep typing decimals,
 *   - an optional single leading minus is preserved.
 * Pure and dependency-free so it can be unit-tested without a DOM.
 */
export function normalizeNumberInput(raw: string, allowNegative = false, decimals = 2): string {
  let s = raw;

  const negative = allowNegative && s.startsWith("-");
  s = s.replace(/-/g, "");

  const parts = s.split(".");
  let intPart = parts[0].replace(/\D/g, "");
  let decPart = parts.length > 1 ? parts.slice(1).join("").replace(/\D/g, "") : "";

  decPart = decimals === 0 ? "" : decPart.slice(0, decimals);

  intPart = intPart.replace(/^0+(?=\d)/, "");

  const hadSeparator = parts.length > 1;
  let normalized = intPart;
  if ((hadSeparator || decPart) && decimals > 0) {
    normalized = `${intPart === "" ? "0" : intPart}.${decPart}`;
  }

  if (negative && normalized !== "") normalized = `-${normalized}`;

  return normalized;
}
