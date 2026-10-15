import { z } from "zod";
import { qOne } from "../db/pool.js";
import { parse } from "../lib/validate.js";
import { authenticate, requireStore, requireRole } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
import { ApiError } from "../lib/api-error.js";
import { getPlanForBusiness } from "../lib/plans.js";
export async function settingsRoutes(app) {
    app.patch("/language", { preHandler: [authenticate, requireRole(ROLES.OWNER, ROLES.MANAGER)] }, async (request) => {
        const storeId = requireStore(request);
        const { language } = parse(z.object({ language: z.enum(["en", "hi", "mr"]) }), request.body);
        const store = await qOne(`UPDATE stores SET language = $1, updated_at = now() WHERE id = $2 RETURNING *`, [language, storeId]);
        if (!store)
            throw ApiError.notFound("Store not found.");
        const plan = await getPlanForBusiness(storeId);
        return { store: plan ? { ...store, planDetails: plan } : store };
    });
}
