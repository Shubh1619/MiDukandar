import { q } from "../db/pool.js";
import { getPlanById } from "../lib/plans.js";
export async function planRoutes(app) {
    app.get("/", async () => {
        const rows = await q(`SELECT id FROM plans WHERE status = 'ACTIVE' ORDER BY display_order ASC, created_at ASC`);
        const plans = await Promise.all(rows.map((row) => getPlanById(String(row.id))));
        return {
            plans: plans
                .filter((plan) => plan !== null)
                .map(({ activeBusinessCount: _activeBusinessCount, moduleCount: _moduleCount, ...plan }) => plan),
        };
    });
}
