const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number | string | null | undefined): string {
  if (amount == null) return "₹0";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "₹0";
  return inrFormatter.format(n);
}

export function formatQty(n: number | string | null | undefined): string {
  if (n == null) return "0";
  return Number(n).toLocaleString("en-IN");
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * `YYYY-MM-DD` for a Date using its LOCAL calendar day. Unlike
 * `toISOString().slice(0, 10)` this never rolls back to the previous day for
 * users east of UTC (e.g. IST) during the early-morning hours.
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date key in the user's local (store) timezone. */
export function todayLocalKey(): string {
  return localDateKey(new Date());
}
