import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { logger } from "./logger.js";
/** Public path segment under which stored files are served (see app.ts). */
export const STORAGE_URL_PREFIX = "/api/uploads/files";
/** Extension derived from the validated content type (never the filename). */
const EXT_BY_CONTENT_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};
/** A single safe object-key path segment: no `/`, `\`, `.`, NUL or spaces. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
/**
 * Builds a path-safe relative key `storeId/entity/<time>-<rand>.<ext>`. The
 * extension comes from the content type (never the client filename) and
 * `entity` must be a single safe path segment, so untrusted input cannot
 * escape the storeId prefix (P2-06).
 */
export function buildStoreKey(storeId, entity, contentType) {
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    if (!ext)
        return { ok: false, reason: "unsupported_type" };
    if (!SAFE_SEGMENT.test(entity))
        return { ok: false, reason: "unsafe_entity" };
    return { ok: true, key: `${storeId}/${entity}/${Date.now()}-${cryptoRandomBase36()}.${ext}` };
}
/**
 * Builds the public URL for a stored key. Prefers an explicit
 * STORAGE_PUBLIC_BASE_URL, then APP_URL, and otherwise returns a root-relative
 * path so the browser resolves it against the web origin (which proxies
 * `/api/*` to this API).
 */
export function storageUrl(key) {
    const base = (config.storagePublicBaseUrl || config.appUrl).replace(/\/+$/, "");
    return `${base}${STORAGE_URL_PREFIX}/${key}`;
}
/**
 * Persists a buffer to the local uploads directory under the given key and
 * returns its public URL, or null when the entity/content-type is refused.
 */
export async function saveUpload(opts) {
    const built = buildStoreKey(opts.storeId, opts.entity, opts.contentType);
    if (!built.ok) {
        logger.warn("storage: refusing upload", {
            entity: opts.entity,
            contentType: opts.contentType,
            reason: built.reason,
        });
        return null;
    }
    const key = built.key;
    try {
        const dest = path.join(config.uploadDir, key);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, opts.buffer);
        return storageUrl(key);
    }
    catch (err) {
        logger.error("storage: upload failed", { error: String(err), key });
        return null;
    }
}
function cryptoRandomBase36() {
    const bytes = randomBytes(6);
    return BigInt("0x" + bytes.toString("hex")).toString(36);
}
