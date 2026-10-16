import path from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Environment loader for the standalone scripts (migrate, seed, …).
 *
 * Mirrors `src/lib/env.ts`. It is duplicated here because the scripts build
 * (`tsconfig.scripts.build.json`) uses `rootDir: "scripts"` and therefore
 * cannot import from `src/`. Keep the two files in sync.
 *
 * Local development reads `.env.local` then `.env`; production reads `.env`
 * only. dotenv never overwrites variables already present in `process.env`.
 */
const isProduction = process.env.NODE_ENV === "production";
const files = isProduction ? [".env"] : [".env.local", ".env"];

for (const file of files) {
  loadEnv({
    path: path.resolve(process.cwd(), file),
    override: false,
    quiet: true,
  });
}
