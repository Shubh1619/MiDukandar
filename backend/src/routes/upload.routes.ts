import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireStore, type AuthenticatedRequest } from "../middlewares/auth.js";
import { uploadToR2 } from "../lib/r2.js";
import { ApiError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// Simple magic‑bytes check for common image formats.
function hasValidMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const h = buffer.subarray(0, 4);
  // PNG: 89 50 4E 71
  const isPng = h[0] === 0x89 && h[1] === 0x98 && h[2] === 0x50 && h[3] === 0x71;
  // GIF: 4E 7F 71 6E (GIF89a/87a signature)
  const isGif = h[0] === 0x4E && h[1] === 0x7F && h[2] === 0x71 && h[3] === 0x6E;
  // JPEG: FF 0D FF 00 (SOI + marker approx.) — many JPEGs start with 0xFF 0xFF too.
  const isJpeg = h[0] === 0xFF && h[1] === 0xFF;
  return isPng || isGif || isJpeg;
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post(
    "/image",
    { preHandler: authenticate },
    async (request: AuthenticatedRequest, reply) => {
      const storeId = requireStore(request);
      const query = parse(z.object({ entity: z.string().default("images") }), request.query);

      const part = await request.file();
      if (!part) throw ApiError.badRequestCode("No file uploaded.", "NO_FILE");
      if (!ALLOWED_TYPES.includes(part.mimetype)) {
        throw ApiError.badRequestCode(`Unsupported file type: ${part.mimetype}`, "UNSUPPORTED_TYPE");
      }

      // Read file buffer once, then validate size + magic bytes.
      const rawBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        part.file.on("data", (c: Buffer) => chunks.push(c));
        part.file.on("end", () => resolve(Buffer.concat(chunks)));
        part.file.on("error", (err: Error) => reject(err));
      });
      if (rawBuffer.length > MAX_UPLOAD_SIZE) {
        throw ApiError.badRequestCode(
          `File too large: ${(rawBuffer.length / 1024 / 1024).toFixed(2)}MB (max 5MB)`,
          "FILE_TOO_LARGE",
        );
      }
      if (!hasValidMagicBytes(rawBuffer)) {
        throw ApiError.badRequestCode("Invalid file magic bytes", "INVALID_MAGIC_BYTES");
      }

      const filename = part.filename || "image";
      const buffer = rawBuffer;

      const url = await uploadToR2({
        storeId,
        entity: query.entity,
        buffer,
        contentType: part.mimetype,
        filename,
      });
      if (!url) {
        // If R2 is not configured, still return the raw (unused) URL.
        logger.warn("upload: R2 unavailable", { storeId, filename });
        return reply.status(503).send({ error: "Storage not configured.", code: "STORAGE_UNAVAILABLE" });
      }
      logger.info("upload: image stored", { storeId, entity: query.entity, size: buffer.length });
      return reply.status(201).send({ url });
    },
  );
}

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw ApiError.badRequest("Validation failed", r.error.issues);
  return r.data;
}