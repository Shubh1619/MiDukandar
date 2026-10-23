/**
 * Asia/Kolkata (IST, UTC+05:30) day helpers.
 *
 * The stores are Indian, so "today", month-to-date and day-range filters must be
 * framed in IST. Doing that with `new Date().toISOString().split("T")[0]` yields
 * a UTC calendar day: between 00:00 and 05:30 IST the server's UTC date is still
 * *yesterday*, so a sale or expense made in the small hours was filed under the
 * previous day (and an expense dated "today" was rejected as "in the future"
 * once the UTC date caught up). These helpers frame the day the shopkeeper
 * actually experiences, independent of the process timezone.
 */
export const IST_OFFSET_MINUTES = 330;
/** `YYYY-MM-DD` for the given instant in IST. Defaults to now. */
export function istDateKey(at = new Date()) {
    const shifted = new Date(at.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
}
/**
 * The UTC instant at which the IST day containing `at` begins (00:00 IST),
 * i.e. `at`'s day at 00:00:00.000+05:30 expressed in UTC.
 */
export function istDayStart(at = new Date()) {
    return new Date(`${istDateKey(at)}T00:00:00.000+05:30`);
}
/**
 * The UTC instant at which the IST day containing `at` ends (23:59:59.999 IST).
 */
export function istDayEnd(at = new Date()) {
    return new Date(`${istDateKey(at)}T23:59:59.999+05:30`);
}
/**
 * Interpret a `YYYY-MM-DD` boundary as an IST wall-clock instant. `endOfDay`
 * picks 23:59:59.999 instead of 00:00:00.000. A full ISO timestamp passed
 * through unchanged is returned verbatim.
 */
export function istBoundary(value, endOfDay = false) {
    if (value.includes("T"))
        return new Date(value);
    const day = value.slice(0, 10);
    return new Date(endOfDay ? `${day}T23:59:59.999+05:30` : `${day}T00:00:00.000+05:30`);
}
