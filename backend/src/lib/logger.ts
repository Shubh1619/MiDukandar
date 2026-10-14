/**
 * Structured logger - every entry is a JSON line. Central place to grow
 * future audit trails (dedicated audit UI is out of MVP scope).
 */

type Level = "info" | "warn" | "error";

function serialize(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data);
  } catch {
    return JSON.stringify({ error: "unserializable log payload" });
  }
}

function emit(level: Level, msg: string, data?: Record<string, unknown>) {
  const fields: Record<string, unknown> = {
    level,
    ts: new Date().toISOString(),
    msg,
    ...(data ?? {}),
  };
  const line = serialize(fields);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
};