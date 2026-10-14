import type { FastifyInstance } from "fastify";
import { q, type Row } from "../db/pool.js";
import { getPlanById, type PlanDefinition } from "../lib/plans.js";

export async function planRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const rows = await q<Row>(
      `SELECT id FROM plans WHERE status = 'ACTIVE' ORDER BY display_order ASC, created_at ASC`,
    );
    const plans = await Promise.all(rows.map((row) => getPlanById(String(row.id))));
    return {
      plans: plans
        .filter((plan): plan is PlanDefinition => plan !== null)
        .map(({ activeBusinessCount: _activeBusinessCount, moduleCount: _moduleCount, ...plan }) => plan),
    };
  });
}
