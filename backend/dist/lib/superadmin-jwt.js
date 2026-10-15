import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { ApiError } from "./api-error.js";
/** Parses a duration like "90s", "15m", "6h", "30d" (or plain seconds) into seconds. */
export function parseDurationSeconds(value) {
    const trimmed = value.trim().toLowerCase();
    const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/.exec(trimmed);
    if (!match)
        throw new Error(`Invalid duration: "${value}"`);
    const n = Number(match[1]);
    const unit = match[2] ?? "s";
    const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
    const seconds = Math.floor(n * mult * 1000) / 1000;
    return Math.max(1, Math.round(seconds));
}
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (s) => {
    const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
    return Buffer.from((s + pad).replace(/-/g, "+").replace(/_/g, "/"), "base64");
};
export function signSuperAdminToken(payload, expiresInSeconds) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const body = { ...payload, role: "SUPERADMIN", iat: now, exp: now + expiresInSeconds };
    const part1 = b64url(Buffer.from(JSON.stringify(header)));
    const part2 = b64url(Buffer.from(JSON.stringify(body)));
    const sig = b64url(createHmac("sha256", config.superAdminJwtSecret).update(`${part1}.${part2}`).digest());
    return `${part1}.${part2}.${sig}`;
}
export function verifySuperAdminToken(token) {
    const parts = token.split(".");
    if (parts.length !== 3)
        throw ApiError.unauthorized("Invalid superadmin token.");
    const [part1, part2, sig] = parts;
    const expected = createHmac("sha256", config.superAdminJwtSecret).update(`${part1}.${part2}`).digest();
    const given = b64urlDecode(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw ApiError.unauthorized("Invalid superadmin token.");
    }
    let header;
    let payload;
    try {
        header = JSON.parse(b64urlDecode(part1).toString("utf8"));
        payload = JSON.parse(b64urlDecode(part2).toString("utf8"));
    }
    catch {
        throw ApiError.unauthorized("Invalid superadmin token.");
    }
    if (header.alg !== "HS256" || typeof payload.sub !== "string") {
        throw ApiError.unauthorized("Invalid superadmin token.");
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) {
        throw ApiError.forbidden("Superadmin session expired. Sign in again.");
    }
    return payload;
}
/** Decodes the token body WITHOUT verifying — used for shadow expiry counts. */
export function decodeSuperAdminToken(token) {
    try {
        const part2 = token.split(".")[1];
        if (!part2)
            return null;
        return JSON.parse(b64urlDecode(part2).toString("utf8"));
    }
    catch {
        return null;
    }
}
