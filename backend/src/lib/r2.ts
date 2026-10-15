import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { logger } from "./logger.js";

let s3: S3Client | null = null;

function r2Client(): S3Client | null {
  if (!config.r2Endpoint || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
    return null;
  }
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: config.r2Endpoint,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
  }
  return s3;
}

/** Extension derived from the validated content type (never the filename). */
const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** A single safe object-key path segment: no `/`, `\`, `.`, NUL or spaces. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

export type R2KeyResult =
  | { ok: true; key: string }
  | { ok: false; reason: "unsupported_type" | "unsafe_entity" };

/**
 * Builds a nav-safe object key `storeId/entity/<time>-<rand>.<ext>`. The
 * extension comes from the content type (never the client filename) and
 * `entity` must be a single safe path segment, so untrusted input cannot
 * escape the storeId prefix (P2-06).
 */
export function buildR2Key(storeId: string, entity: string, contentType: string): R2KeyResult {
  const ext = EXT_BY_CONTENT_TYPE[contentType];
  if (!ext) return { ok: false, reason: "unsupported_type" };
  if (!SAFE_SEGMENT.test(entity)) return { ok: false, reason: "unsafe_entity" };
  return { ok: true, key: `${storeId}/${entity}/${Date.now()}-${cryptoRandomBase36()}.${ext}` };
}

/**
 * Uploads a buffer to Cloudflare R2 under the given key, returning the CDN
 * URL.
 */
export async function uploadToR2(opts: {
  storeId: string;
  entity: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string | null> {
  const client = r2Client();
  if (!client) {
    logger.warn("r2: credentials not configured - skipping upload", { entity: opts.entity });
    return null;
  }
  const built = buildR2Key(opts.storeId, opts.entity, opts.contentType);
  if (!built.ok) {
    logger.warn("r2: refusing upload", {
      entity: opts.entity,
      contentType: opts.contentType,
      reason: built.reason,
    });
    return null;
  }
  const key = built.key;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.r2Bucket,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.contentType,
      }),
    );
    if (config.r2PublicBaseUrl) {
      return `${config.r2PublicBaseUrl}/${key}`;
    }
    // No public URL configured → return a signed URL for retrieval.
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.r2Bucket, Key: key }),
      { expiresIn: 3600 },
    );
    return url;
  } catch (err) {
    logger.error("r2: upload failed", { error: String(err), key });
    return null;
  }
}

function cryptoRandomBase36(): string {
  const bytes = randomBytes(6);
  return BigInt("0x" + bytes.toString("hex")).toString(36);
}