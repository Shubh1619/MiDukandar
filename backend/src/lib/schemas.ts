import { z } from "zod";

/** Shared sale/purchase line item - the common fields both flows accept. */
export const lineItemBaseSchema = z.object({
  productId: z.string().min(1).nullable().optional(),
  /** Free-text label for walk-in/generic lines when no catalog product is used. */
  productName: z.string().min(1).max(150).optional(),
  qty: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0).optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
});

/** Every line must reference a catalog product OR carry a free-text name. */
export function requireLineName(line: { productId?: string | null; productName?: string }): boolean {
  return Boolean(line.productId || line.productName);
}

export const lineItemSchema = lineItemBaseSchema.refine(requireLineName, {
  message: "Either productId or productName is required",
});