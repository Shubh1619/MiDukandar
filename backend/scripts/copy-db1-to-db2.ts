import "./load-env.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import pg from "pg";

/**
 * One-way data migration from the primary database (DB1) to the fallback
 * database (DB2). The API fails over to DB2 when DB1 is unreachable, so DB2
 * must hold a copy of the application data — not just the schema.
 *
 * Source:  SOURCE_DATABASE_URL (or DB1_DATABASE_URL). When unset, the root
 *          .env.prod is read (DIRECT_URL preferred over DATABASE_URL).
 * Target:  TARGET_DATABASE_URL (or DATABASE_URL_2). Run `npm run migrate`
 *          against the target first so the schema exists.
 *
 * Rows are upserted by primary key, so the command is safe to re-run. The
 * source should be quiescent while it runs. `schema_migrations` is skipped:
 * the target records its own migration history.
 */

const { Client } = pg;

// Preserve DATE values exactly (pg's default parser shifts them by the local
// UTC offset). This matches src/db/pool.ts.
pg.types.setTypeParser(1082, (value) => value);

type ColumnMeta = {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
};

type TableMeta = {
  name: string;
  columns: ColumnMeta[];
  primaryKey: string[];
};

type SelfRefFixup = { column: string; key: string };

// FK-safe order. `stores.referred_by_store_id` is self-referential, so it is
// written in a second pass (see SELF_REF_FIXUPS).
const COPY_ORDER = [
  "plans",
  "stores",
  "super_admins",
  "users",
  "plan_modules",
  "roles_permissions",
  "store_page_access",
  "expense_categories",
  "suppliers",
  "customers",
  "products",
  "platform_settings",
  "purchases",
  "purchase_items",
  "purchase_orders",
  "purchase_order_items",
  "supplier_payments",
  "sales",
  "sale_items",
  "payments",
  "ledger_entries",
  "stock_movements",
  "expenses",
  "recurring_expenses",
  "held_bills",
  "udhaari_entries",
  "udhaari_payments",
  "user_invites",
  "audit_logs",
  "superadmin_audit_logs",
  "superadmin_refresh_tokens",
  "refresh_tokens",
  "pin_reset_tokens",
  "sms_messages",
  "sms_usage_daily",
  "otps",
  "webhook_events",
] as const;

const SKIP_TABLES = new Set(["schema_migrations"]);
const SELF_REF_FIXUPS: Record<string, SelfRefFixup> = {
  stores: { column: "referred_by_store_id", key: "id" },
};

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim())?.trim();
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function safeHost(connectionString: string): string {
  try {
    return new URL(connectionString).host;
  } catch {
    return "<invalid-url>";
  }
}

async function resolveSourceUrl(): Promise<string> {
  const explicit = firstNonEmpty(
    process.env.SOURCE_DATABASE_URL,
    process.env.DB1_DATABASE_URL,
    process.env.MIGRATION_SOURCE_DATABASE_URL,
  );
  if (explicit) return explicit;

  const candidates = [
    process.env.SOURCE_ENV_FILE,
    path.resolve(process.cwd(), "..", ".env.prod"),
  ].filter((value): value is string => Boolean(value));

  for (const file of candidates) {
    try {
      const parsed = parseDotenv(await readFile(file, "utf8"));
      const url = firstNonEmpty(parsed.SOURCE_DATABASE_URL, parsed.DIRECT_URL, parsed.DATABASE_URL);
      if (url) return url;
    } catch {
      // A missing/optional env file is not fatal when an explicit URL was given.
    }
  }

  throw new Error(
    "Set SOURCE_DATABASE_URL to the primary (DB1) connection string, or place it in backend/.env.local.",
  );
}

async function introspect(client: pg.Client, schema: string): Promise<Map<string, TableMeta>> {
  const tables = new Map<string, TableMeta>();

  const tableRows = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
    [schema],
  );
  for (const row of tableRows.rows) {
    tables.set(row.table_name, { name: row.table_name, columns: [], primaryKey: [] });
  }

  const columnRows = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, ordinal_position`,
    [schema],
  );
  for (const row of columnRows.rows) {
    tables.get(row.table_name)?.columns.push({
      name: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === "YES",
      columnDefault: row.column_default,
    });
  }

  const pkRows = await client.query<{ table_name: string; column_name: string }>(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_catalog = tc.constraint_catalog
        AND kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
        AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = $1 AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY tc.table_name, kcu.ordinal_position`,
    [schema],
  );
  for (const row of pkRows.rows) {
    tables.get(row.table_name)?.primaryKey.push(row.column_name);
  }

  return tables;
}

function keysetPredicate(
  primaryKey: string[],
  lastRow: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const predicates: string[] = [];
  const params: unknown[] = [];

  for (let i = 0; i < primaryKey.length; i++) {
    const parts: string[] = [];
    for (let j = 0; j < i; j++) {
      params.push(lastRow[primaryKey[j]] ?? null);
      parts.push(`${quoteIdent(primaryKey[j])} = $${params.length}`);
    }
    params.push(lastRow[primaryKey[i]] ?? null);
    parts.push(`${quoteIdent(primaryKey[i])} > $${params.length}`);
    predicates.push(`(${parts.join(" AND ")})`);
  }

  return { sql: predicates.join(" OR "), params };
}

async function copyTable(
  source: pg.Client,
  target: pg.Client,
  schema: string,
  sourceTable: TableMeta,
  targetTable: TableMeta,
  batchSize: number,
): Promise<void> {
  const sourceNames = new Set(sourceTable.columns.map((column) => column.name));
  const columns = targetTable.columns.filter((column) => sourceNames.has(column.name));
  const primaryKey = targetTable.primaryKey;

  if (columns.length === 0) {
    console.warn(`skip   ${targetTable.name} (no matching columns in source)`);
    return;
  }
  if (primaryKey.some((column) => !columns.some((c) => c.name === column))) {
    throw new Error(
      `${targetTable.name}: source is missing primary key column(s) ${primaryKey
        .filter((column) => !columns.some((c) => c.name === column))
        .join(", ")}`,
    );
  }

  const tableRef = `${quoteIdent(schema)}.${quoteIdent(targetTable.name)}`;
  const columnList = columns.map((column) => quoteIdent(column.name)).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const updateColumns = columns.filter((column) => !primaryKey.includes(column.name));
  const updateSet = updateColumns
    .map((column) => `${quoteIdent(column.name)} = EXCLUDED.${quoteIdent(column.name)}`)
    .join(", ");
  const conflictSql = primaryKey.length
    ? `ON CONFLICT (${primaryKey.map(quoteIdent).join(", ")}) ${
        updateSet ? `DO UPDATE SET ${updateSet}` : "DO NOTHING"
      }`
    : "DO NOTHING";
  const insertSql = `INSERT INTO ${tableRef} (${columnList}) VALUES (${placeholders}) ${conflictSql}`;

  const orderBy = (primaryKey.length ? primaryKey : columns.map((column) => column.name))
    .map(quoteIdent)
    .join(", ");
  const selectSql = `SELECT ${columnList} FROM ${tableRef}`;

  const fixup = SELF_REF_FIXUPS[targetTable.name];
  const fixups: Array<{ id: unknown; value: unknown }> = [];

  let upserted = 0;
  let unchanged = 0;
  let offset = 0;
  let lastRow: Record<string, unknown> | null = null;

  while (true) {
    let readSql = selectSql;
    const readParams: unknown[] = [];

    if (primaryKey.length && lastRow) {
      const keyset = keysetPredicate(primaryKey, lastRow);
      readSql += ` WHERE ${keyset.sql}`;
      readParams.push(...keyset.params);
    }

    const limitIndex = readParams.length + 1;
    readSql += ` ORDER BY ${orderBy} LIMIT $${limitIndex}`;
    readParams.push(batchSize);
    if (!primaryKey.length) {
      readSql += ` OFFSET $${limitIndex + 1}`;
      readParams.push(offset);
    }

    const result = await source.query(readSql, readParams);
    const rows = result.rows as Array<Record<string, unknown>>;
    if (rows.length === 0) break;

    for (const row of rows) {
      const values = columns.map((column) => {
        if (fixup && column.name === fixup.column) return null;
        return row[column.name] ?? null;
      });
      const written = await target.query(insertSql, values);
      if (written.rowCount === 0) unchanged++;
      else upserted++;

      if (fixup && row[fixup.column] != null) {
        fixups.push({ id: row[fixup.key] ?? null, value: row[fixup.column] });
      }
    }

    if (!primaryKey.length) offset += rows.length;
    lastRow = rows[rows.length - 1];
    if (rows.length < batchSize) break;
  }

  if (fixup) {
    const updateSql = `UPDATE ${tableRef} SET ${quoteIdent(fixup.column)} = $1 WHERE ${quoteIdent(fixup.key)} = $2`;
    for (const item of fixups) {
      await target.query(updateSql, [item.value, item.id]);
    }
  }

  console.log(`ok     ${targetTable.name}: ${upserted} upserted, ${unchanged} unchanged`);
}

async function main(): Promise<void> {
  const sourceUrl = await resolveSourceUrl();
  const targetUrl = firstNonEmpty(
    process.env.TARGET_DATABASE_URL,
    process.env.DATABASE_URL_2,
    process.env.FALLBACK_DATABASE_URL,
  );
  if (!targetUrl) {
    throw new Error(
      "Set TARGET_DATABASE_URL (or DATABASE_URL_2) to the fallback (DB2) connection string.",
    );
  }
  if (sourceUrl === targetUrl) {
    throw new Error("SOURCE_DATABASE_URL and TARGET_DATABASE_URL must be different databases.");
  }

  const batchSize = Number(process.env.COPY_BATCH_SIZE ?? "500");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    throw new Error("COPY_BATCH_SIZE must be an integer between 1 and 5000.");
  }

  const schema = process.env.COPY_SCHEMA?.trim() || "public";
  const source = new Client({ connectionString: sourceUrl, connectionTimeoutMillis: 10000 });
  const target = new Client({ connectionString: targetUrl, connectionTimeoutMillis: 10000 });

  console.log(
    `Copying app data: ${safeHost(sourceUrl)} -> ${safeHost(targetUrl)} (schema: ${schema})`,
  );

  try {
    await Promise.all([source.connect(), target.connect()]);
    const [sourceTables, targetTables] = await Promise.all([
      introspect(source, schema),
      introspect(target, schema),
    ]);

    const missingSchema = [...targetTables.values()].filter((table) => sourceTables.has(table.name));
    if (missingSchema.length === 0) {
      throw new Error(`No matching tables found in ${schema}. Run the migrations against the target first.`);
    }

    const ordered: string[] = [...COPY_ORDER].filter((name) => !SKIP_TABLES.has(name));
    const extra = [...targetTables.keys()].filter(
      (name) => !SKIP_TABLES.has(name) && !ordered.includes(name),
    );
    if (extra.length) {
      console.warn(`warn   copying unmapped target tables last: ${extra.sort().join(", ")}`);
      ordered.push(...extra.sort());
    }

    await target.query("BEGIN");
    try {
      for (const name of ordered) {
        const sourceTable = sourceTables.get(name);
        const targetTable = targetTables.get(name);
        if (!targetTable) continue;
        if (!sourceTable) {
          console.warn(`skip   ${name} (missing in source)`);
          continue;
        }
        await copyTable(source, target, schema, sourceTable, targetTable, batchSize);
      }
      await target.query("COMMIT");
    } catch (error) {
      await target.query("ROLLBACK");
      throw error;
    }

    console.log("Data copy complete. DB2 now mirrors the DB1 application data.");
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Data copy failed: ${message}`);
  if (/quota/i.test(message)) {
    console.error(
      "DB1 refused the read. Restore its quota/access (or restore a backup and point SOURCE_DATABASE_URL at it), then re-run.",
    );
  }
  process.exit(1);
});
