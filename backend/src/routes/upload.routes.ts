import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireStore, type AuthenticatedRequest } from "../middlewares/auth.js";
import { uploadToR2 } from "../lib/r2.js";
import { ApiError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// Detects the image format from its container signature. Returns the canonical
// content type, or null when the bytes match no supported format (P2-05).
function detectImageType(b: Buffer): string | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "image/png";

  // JPEG: FF D8 FF (SOI + first marker)
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";

  // GIF: "GIF87a" / "GIF89a"
  if (
    b.length >= 6 &&
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61
  ) return "image/gif";

  // WEBP: "RIFF" <4-byte size> "WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp";

  return null;
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
      const detected = detectImageType(rawBuffer);
      if (!detected || detected !== part.mimetype) {
        throw ApiError.badRequestCode(
          "File content does not match a supported image format",
          "INVALID_MAGIC_BYTES",
        );
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