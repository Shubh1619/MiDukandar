import { z } from "zod";
import { q, qOne } from "../db/pool.js";
import { config } from "../config.js";
import { ApiError } from "../lib/api-error.js";
import { parse } from "../lib/validate.js";
import { authenticate, requireStore, requireRole } from "../middlewares/auth.js";
import { ROLES } from "../middlewares/auth.types.js";
const referralShareUrl = (code) => {
    const base = config.appUrl.replace(/\/+$/, "");
    const path = `/onboard?ref=${encodeURIComponent(code)}`;
    return base ? `${base}${path}` : path;
};
async function codeFor(storeId) {
    const row = await qOne(`SELECT referral_code FROM stores WHERE id = $1`, [storeId]);
    if (!row)
        throw ApiError.notFound("Store not found.");
    return String(row.referral_code);
}
export async function referralRoutes(app) {
    // Current store's referral code, share link and referred stores.
    app.get("/", { preHandler: [authenticate, requireRole(ROLES.OWNER)] }, async (request) => {
        const storeId = requireStore(request);
        const code = await codeFor(storeId);
        const referrals = await q(`SELECT name, created_at FROM stores
          WHERE referred_by_store_id = $1
          ORDER BY created_at DESC
          LIMIT 100`, [storeId]);
        return {
            code,
            shareUrl: referralShareUrl(code),
            referredCount: referrals.length,
            referrals: referrals.map((r) => ({ storeName: r.name, createdAt: r.created_at })),
        };
    });
    // Apply a friend's referral code to the current store (once).
    app.post("/apply", { preHandler: [authenticate, requireRole(ROLES.OWNER)] }, async (request) => {
        const storeId = requireStore(request);
        const body = parse(z.object({ code: z.string().min(4).max(32) }), request.body);
        const code = body.code.trim().toUpperCase();
        const self = await qOne(`SELECT referral_code, referred_by_store_id FROM stores WHERE id = $1`, [storeId]);
        if (!self)
            throw ApiError.notFound("Store not found.");
        if (String(self.referral_code) === code) {
            throw ApiError.badRequest("You cannot use your own referral code.");
        }
        if (self.referred_by_store_id) {
            throw ApiError.conflict("A referral code is already applied to this store.");
        }
        const referrer = await qOne(`SELECT id FROM stores WHERE referral_code = $1`, [code]);
        if (!referrer)
            throw ApiError.badRequest("Invalid referral code.");
        await q(`UPDATE stores SET referred_by_store_id = $1 WHERE id = $2`, [referrer.id, storeId]);
        return { ok: true };
    });
}
// Resolve a referral code to a store id (used at registration). Returns null
// when the code is unknown.
export async function resolveReferralCode(code) {
    if (!code)
        return null;
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 4)
        return null;
    const referrer = await qOne(`SELECT id FROM stores WHERE referral_code = $1`, [normalized]);
    return referrer ? String(referrer.id) : null;
}
