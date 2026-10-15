import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir =
  process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), "migrations");

const { Client } = pg;
const DATA_RESET_MIGRATION = "015_reset_application_data_except_superadmins.sql";
const DATA_RESET_CONFIRMATION = "DELETE_ALL_DATA_EXCEPT_SUPERADMINS";
// Prefer the direct connection (Neon docs: run migrations/DDL over the
// non-pooler endpoint; the app uses the pooled DATABASE_URL at runtime).
const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL) as string;
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
  const applied = new Set(rows.map((r) => r.name as string));

  // Guard against duplicate numeric prefixes (e.g. 012_plans.sql and
  // 012_refresh_tokens_grace.sql). Applied state is keyed by full filename, so
  // these still apply exactly once — but the numeric prefix no longer implies a
  // unique position. Surface it so the ordering (lexical by full filename) is
  // never a silent assumption. Non-fatal: existing databases already record the
  // exact filenames, so failing here would block otherwise-valid re-runs.
  const byPrefix = new Map<string, string[]>();
  for (const file of files) {
    const prefix = /^(\d+)_/.exec(file)?.[1];
    if (!prefix) continue;
    (byPrefix.get(prefix) ?? byPrefix.set(prefix, []).get(prefix)!).push(file);
  }
  for (const [prefix, group] of byPrefix) {
    if (group.length > 1) {
      console.warn(
        `warn   duplicate migration prefix ${prefix}: ${group.join(", ")} (applied in lexical order by full filename)`,
      );
    }
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }
    if (file === DATA_RESET_MIGRATION) {
      if (process.env.RESET_DATA_CONFIRM !== DATA_RESET_CONFIRMATION) {
        console.log(`skip   ${file} (set RESET_DATA_CONFIRM=${DATA_RESET_CONFIRMATION} to run)`);
        continue;
      }
      await client.query(`SELECT set_config('app.reset_data_confirm', $1, false)`, [DATA_RESET_CONFIRMATION]);
    }
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply  ${file} ...`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
      await client.query("COMMIT");
      console.log(`done   ${file}`);
    } catch (err) {
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