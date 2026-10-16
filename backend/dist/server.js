import "./lib/env.js";
import { buildApp } from "./app.js";
import { config, startupSummary } from "./config.js";
import { logger } from "./lib/logger.js";
import { pool } from "./db/pool.js";
async function currentMigrationVersion() {
    try {
        const { rows } = await pool.query(`SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1`);
        return rows[0]?.name ?? "(none applied)";
    }
    catch {
        return "(unavailable)";
    }
}
async function main() {
    const app = buildApp({ logger: true });
    const shutdown = async () => {
        logger.info("shutdown: starting");
        await app.close();
        await pool.end();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    try {
        // Active environment + schema version, so logs from local and Render are
        // unambiguous. Never includes secrets (see startupSummary).
        logger.info("startup", {
            ...startupSummary(),
            migration: await currentMigrationVersion(),
        });
        await app.listen({ port: config.port, host: "0.0.0.0" });
        logger.info("midukandar backend listening", { port: config.port, env: config.nodeEnv });
    }
    catch (err) {
        logger.error("fatal: failed to start server", { error: String(err) });
        process.exit(1);
    }
}
void main();
