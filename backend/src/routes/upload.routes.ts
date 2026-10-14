import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireStore, type AuthenticatedRequest } from "../middlewares/auth.js";
import { uploadToR2 } from "../lib/r2.js";
import { ApiError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

      const filename = part.filename || "image";
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        part.file.on("data", (c: Buffer) => chunks.push(c));
        part.file.on("end", () => resolve(Buffer.concat(chunks)));
        part.file.on("error", (err: Error) => reject(err));
      });

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