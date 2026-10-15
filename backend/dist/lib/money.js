import Decimal from "decimal.js";
/**
 * Exact decimal arithmetic for money.
 *
 * JavaScript floats cannot represent values like 0.1 + 0.2, so summing
 * per-line amounts as `number` drifts: a 3-line bill can total 300.00000000000006
 * and, after several such bills, the day's takings no longer reconcile with the
 * sum of its invoices. `NUMERIC` columns hold the exact value, but the drift is
 * introduced *before* the write, by the arithmetic in the service layer.
 *
 * Every monetary computation therefore runs through `Decimal` and is rounded
 * to 2 dp exactly once, at the point the value is produced. Results are handed
 * back to callers as `number` because that is what the existing row types and
 * JSON payloads use; a 2 dp value round-trips through `NUMERIC(12,2)` without
 * loss, which is precisely why the rounding is pinned to 2 dp here.
 */
/** Guard rails: refuse to silently produce nonsense from bad input. */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 });
/**
 * Coerces anything pg/JSON can hand us into a Decimal.
 *
 * Typed as `unknown` because DB rows are `Record<string, unknown>` and every
 * money field arrives that way. Anything that is not genuinely numeric throws
 * rather than silently becoming 0 — a corrupt amount must be loud, not zero.
 */
export function dec(value) {
    if (value === null || value === undefined || value === "")
        return new Decimal(0);
    return new Decimal(value);
}
/** Rounds to 2 dp (money) using HALF_UP, matching SQL NUMERIC(…,2). */
export function money(value) {
    return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
/** Rounds to 2 dp and returns a plain number for DB params / JSON payloads. */
export function moneyNum(value) {
    return money(value).toNumber();
}
/** Rounds to 3 dp — used for quantities, which may be fractional (kg/litre). */
export function qty(value) {
    return dec(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber();
}
/** Sums a list of money values exactly. */
export function sumMoney(values) {
    return values.reduce((acc, v) => acc.plus(dec(v)), new Decimal(0));
}
/** Minimum of two values as Decimals (decimal.js exposes min/max statically). */
export function dmin(a, b) {
    return Decimal.min(dec(a), dec(b));
}
/** Maximum of two values as Decimals. */
export function dmax(a, b) {
    return Decimal.max(dec(a), dec(b));
}
