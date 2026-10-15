import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "migrations");
const { Client } = pg;
// Prefer the direct connection (Neon docs: run migrations/DDL over the
// non-pooler endpoint; the app uses the pooled DATABASE_URL at runtime).
const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL);
if (!connectionString) {
    console.error("DATABASE_URL is required to run migrations.");
    process.exit(1);
}
async function main() {
    const client = new Client({ connectionString });
    await client.connect();
    await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query(`SELECT name FROM schema_migrations`);
    const applied = new Set(rows.map((r) => r.name));
    for (const file of files) {
        if (applied.has(file)) {
            console.log(`skip   ${file} (already applied)`);
            continue;
        }
        const sql = await readFile(path.join(migrationsDir, file), "utf8");
        console.log(`apply  ${file} ...`);
        await client.query("BEGIN");
        try {
            await client.query(sql);
            await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
            await client.query("COMMIT");
            console.log(`done   ${file}`);
        }
        catch (err) {
            await client.query("ROLLBACK");
            console.error(`FAILED ${file}:`, err instanceof Error ? err.message : err);
            process.exit(1);
        }
    }
    await client.end();
    console.log("All migrations applied.");
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
