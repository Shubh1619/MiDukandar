import "dotenv/config";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { pool } from "./db/pool.js";
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
        await app.listen({ port: config.port, host: "0.0.0.0" });
        logger.info("midukandar backend listening", { port: config.port, env: config.nodeEnv });
    }
    catch (err) {
        logger.error("fatal: failed to start server", { error: String(err) });
        process.exit(1);
    }
}
void main();
