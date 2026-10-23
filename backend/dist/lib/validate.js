import { z } from "zod";
import { ApiError } from "./api-error.js";
export function parse(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw ApiError.badRequest("Validation failed", result.error.issues);
    }
    return result.data;
}
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});
const optionalDateString = z
    .string()
    .optional()
    .refine((v) => v === undefined || v.trim() === "" || !Number.isNaN(Date.parse(v)), { message: "Invalid date. Use an ISO date such as 2026-01-31." });
export const dateRangeSchema = z.object({
    from: optionalDateString,
    to: optionalDateString,
});
