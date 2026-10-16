import path from "node:path";
import { config as loadEnv } from "dotenv";
/**
 * Loads environment variables for the current process.
 *
 * Local development reads `backend/.env.local` first, then `backend/.env`.
 * Production reads `.env` only — on Render (and any real host) the values come
 * from the dashboard/secret store, so the dotenv files are normally absent
 * there anyway.
 *
 * dotenv never overwrites a variable that already exists in `process.env`, so
 * a value injected by the host shell always wins over the on-disk files.
 * Import this module before anything that reads `process.env` at
 * module-evaluation time (config.ts does this itself).
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
