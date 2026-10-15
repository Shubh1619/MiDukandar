import { pingDb } from "../db/pool.js";
export async function healthRoutes(app) {
    app.get("/", async () => ({
        status: "ok",
        service: "midukandar-backend",
        time: new Date().toISOString(),
    }));
    app.get("/ready", async (_req, reply) => {
        const up = await pingDb();
        if (!up)
            return reply.status(503).send({ status: "degraded", db: "down" });
        return { status: "ready", db: "up" };
    });
}
