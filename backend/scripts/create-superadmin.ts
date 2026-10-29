import "./load-env.js";
import bcrypt from "bcryptjs";
import pg from "pg";

/**
 * Bootstraps (or rotates the password of) a platform superadmin.
 *
 * Local usage:
 *   npm run superadmin:create -- --email admin@midukandar.com --name "Platform Admin" --password "secret123"
 *
 * Container/auto-create:
 *   SUPERADMIN_EMAIL / SUPERADMIN_NAME / SUPERADMIN_PASSWORD env vars. The
 *   backend container entrypoint runs this automatically after migrations.
 *
 * Rotation: the bootstrap is create-only. Re-setting the password on every
 * boot meant an operator could never change it (the next deploy would restore
 * the env value) and any stale SUPERADMIN_PASSWORD in the environment silently
 * re-opened a known credential. Pass `--rotate` (or set
 * SUPERADMIN_ROTATE_PASSWORD=true) when you genuinely want to replace the
 * stored hash.
 */

const args = process.argv.slice(2);
const get = (k: string) => {
  const idx = args.indexOf(k);
  return idx >= 0 ? args[idx + 1] : undefined;
};
const shouldRotate =
  args.includes("--rotate") ||
  ["1", "true", "yes"].includes(
    (process.env.SUPERADMIN_ROTATE_PASSWORD ?? "").trim().toLowerCase(),
  );

async function main() {
  const email = (get("--email") ?? process.env.SUPERADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (get("--name") ?? process.env.SUPERADMIN_NAME ?? "").trim();
  const password = get("--password") ?? process.env.SUPERADMIN_PASSWORD ?? "";

  if (!email && !name && !password) {
    console.log("superadmin: not configured (SUPERADMIN_EMAIL/NAME/PASSWORD unset) - skipping");
    process.exit(0);
  }
  if (!email || !name || password.length < 8) {
    console.error(
      "superadmin: SUPERADMIN_EMAIL, SUPERADMIN_NAME and a password (min 8 chars) are required.",
    );
    process.exit(1);
  }

  const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL) as string;
  if (!connectionString) {
    console.error("superadmin: DATABASE_URL is required.");
    process.exit(1);
  }

  const { Client } = pg;
  const client = new Client({ connectionString });
  await client.connect();

  const passwordHash = bcrypt.hashSync(password, 10);
  try {
    // Create-only by default: an existing account keeps whatever password the
    // operator last set. `--rotate` is the single explicit way to replace it.
    const { rows } = await client.query(
      shouldRotate
        ? `INSERT INTO super_admins (name, email, password_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE
             SET name = EXCLUDED.name,
                 password_hash = EXCLUDED.password_hash,
                 updated_at = now()
           RETURNING id, email, (xmax = 0) AS created`
        : `INSERT INTO super_admins (name, email, password_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
           RETURNING id, email, (xmax = 0) AS created`,
      [name, email, passwordHash],
    );
    const row = rows[0] as { id: string; email: string; created: boolean };
    if (row.created) {
      console.log(`superadmin: ${row.email} (id ${row.id}) created.`);
    } else if (shouldRotate) {
      console.log(`superadmin: ${row.email} (id ${row.id}) password rotated.`);
    } else {
      console.log(
        `superadmin: ${row.email} (id ${row.id}) already exists - password left unchanged ` +
          `(pass --rotate or set SUPERADMIN_ROTATE_PASSWORD=true to replace it).`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});