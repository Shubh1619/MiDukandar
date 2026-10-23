/**
 * Structured logger - every entry is a JSON line. Central place to grow
 * future audit trails (dedicated audit UI is out of MVP scope).
 */
function serialize(data) {
    try {
        return JSON.stringify(data);
    }
    catch {
        return JSON.stringify({ error: "unserializable log payload" });
    }
}
function emit(level, msg, data) {
    const fields = {
        level,
        ts: new Date().toISOString(),
        msg,
        ...(data ?? {}),
    };
    const line = serialize(fields);
    if (level === "error") {
        process.stderr.write(line + "\n");
    }
    else {
        process.stdout.write(line + "\n");
    }
}
export const logger = {
    info: (msg, data) => emit("info", msg, data),
    warn: (msg, data) => emit("warn", msg, data),
    error: (msg, data) => emit("error", msg, data),
};
/**
 * Masks an email address so it can be written to a log line. The local part
 * keeps its first and last character with `***` in between; the domain is left
 * intact because it is not personally identifying and tells an operator which
 * provider or tenant an incident involves. `owner@shop.com` → `o***r@shop.com`.
 */
export function maskEmail(value) {
    if (!value)
        return "";
    const at = value.lastIndexOf("@");
    if (at <= 0)
        return "***";
    const local = value.slice(0, at);
    const domain = value.slice(at); // includes the "@"
    if (local.length === 1)
        return `***${domain}`;
    return `${local[0]}***${local[local.length - 1]}${domain}`;
}
/**
 * Masks a phone number for logs, keeping only the last four digits — enough
 * for an operator to match a report ("the number ending 3210") without storing
 * the customer's full number in the log stream.
 */
export function maskPhone(value) {
    const digits = (value ?? "").replace(/\D/g, "");
    if (!digits)
        return "";
    if (digits.length <= 4)
        return "*".repeat(digits.length);
    return "*".repeat(digits.length - 4) + digits.slice(-4);
}
