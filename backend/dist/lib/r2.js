import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { logger } from "./logger.js";
let s3 = null;
function r2Client() {
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
/**
 * Uploads a buffer to Cloudflare R2 under the given key, returning the CDN
 * URL. Creates the key nav-safe (storeId/entity/random.ext).
 */
export async function uploadToR2(opts) {
    const client = r2Client();
    if (!client) {
        logger.warn("r2: credentials not configured - skipping upload", { entity: opts.entity });
        return null;
    }
    const ext = opts.filename.split(".").pop()?.toLowerCase() ?? "bin";
    const key = `${opts.storeId}/${opts.entity}/${Date.now()}-${cryptoRandomBase36()}.${ext}`;
    try {
        await client.send(new PutObjectCommand({
            Bucket: config.r2Bucket,
            Key: key,
            Body: opts.buffer,
            ContentType: opts.contentType,
        }));
        if (config.r2PublicBaseUrl) {
            return `${config.r2PublicBaseUrl}/${key}`;
        }
        // No public URL configured → return a signed URL for retrieval.
        const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: config.r2Bucket, Key: key }), { expiresIn: 3600 });
        return url;
    }
    catch (err) {
        logger.error("r2: upload failed", { error: String(err), key });
        return null;
    }
}
function cryptoRandomBase36() {
    const bytes = randomBytes(6);
    return BigInt("0x" + bytes.toString("hex")).toString(36);
}
