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
