import pg from "pg";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

// NUMERIC/OID 1700 → number; INT8/OID 20 → number (counts, sequences)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// DATE/OID 1082 → keep the raw "YYYY-MM-DD". pg's default parser builds a Date
// at LOCAL midnight, which a UTC/IST offset then shifts a day when serialized.
pg.types.setTypeParser(1082, (v) => (v === null ? null : v));

const poolOptions = {
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
};

/** Hostname only — connection strings contain credentials and must never be logged. */
function safeHost(connectionString: string): string {
  try {
    return new URL(connectionString).host;
  } catch {
    return "<invalid-url>";
  }
}

const urls = [config.databaseUrl];
if (
  config.databaseUrlFallback &&
  config.databaseUrlFallback !== config.databaseUrl &&
  !urls.includes(config.databaseUrlFallback)
) {
  urls.push(config.databaseUrlFallback);
}

const pools = urls.map((connectionString) => new pg.Pool({ connectionString, ...poolOptions }));
pools.forEach((p, index) => {
  p.on("error", (err) => {
    logger.error("pg: pool error", { host: safeHost(urls[index]), error: err.message });
  });
});

let activeIndex = 0;

/**
 * Only connection-level failures trigger failover. The query did not run in
 * those cases, so retrying it on the secondary database is safe. SQL errors
 * (constraint violations, missing relations, bad syntax) are never retried —
 * a write may already have committed.
 */
function isFailoverError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const code = e?.code ?? "";
  const message = (e?.message ?? "").toLowerCase();
  return (
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "57P01", "57P03"].includes(
      code,
    ) ||
    message.includes("exceeded the quota") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("timeout exceeded when trying to connect")
  );
}

/** Runs `fn` on the active pool, moving to the next database on connection failure. */
async function withPool<T>(fn: (pool: pg.Pool) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < pools.length; attempt++) {
    const index = (activeIndex + attempt) % pools.length;
    try {
      const result = await fn(pools[index]);
      if (index !== activeIndex) {
        logger.warn("db: failed over to secondary database", { host: safeHost(urls[index]) });
        activeIndex = index;
      }
      return result;
    } catch (err) {
      lastError = err;
      if (!isFailoverError(err) || attempt === pools.length - 1) throw err;
      logger.warn("db: database unavailable, trying next", {
        host: safeHost(urls[index]),
        error: (err as Error).message,
      });
    }
  }
  throw lastError;
}

/**
 * Pool facade with the same call surface as pg.Pool so every caller — including
 * the direct `pool.query` uses — gets failover without changes at the call site.
 */
export const pool = {
  query: <R extends pg.QueryResultRow = pg.QueryResultRow, I extends unknown[] = unknown[]>(
    text: string,
    params?: I,
  ) => withPool((p) => p.query<R, I>(text, params as pg.QueryConfigValues<I> | undefined)),
  connect: () => withPool((p) => p.connect()),
  end: async () => {
    await Promise.all(pools.map((p) => p.end()));
  },
};

/** Hostname of the database currently serving queries — safe for logs/health output. */
export function activeDbHost(): string {
  return safeHost(urls[activeIndex]);
}

export type Row = Record<string, unknown>;

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function toCamel(row: pg.QueryResultRow): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[camel(k)] = v;
    out[k] = v;
  }
  return out;
}

export function mapRows<T = Row>(rows: pg.QueryResultRow[]): T[] {
  return rows.map((r) => toCamel(r)) as unknown as T[];
}

export function mapFirst<T = Row>(rows: pg.QueryResultRow[]): T | null {
  return rows.length ? (toCamel(rows[0]) as unknown as T) : null;
}

/** Runs a query, returns mapped (camelCase, numbers) rows. */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return mapRows<T>(res.rows as pg.QueryResultRow[]);
}

/** Runs a query, returns the first mapped row or null. */
export async function qOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Runs a write query, returns rowCount. */
export async function qExec(text: string, params: unknown[] = []): Promise<number> {
  const res = await pool.query(text, params);
  return res.rowCount ?? 0;
}

export type DbClient = {
  query(text: string, params?: unknown[]): Promise<pg.QueryResult>;
  q<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  qOne<T = Row>(text: string, params?: unknown[]): Promise<T | null>;
};

/** Pool-bound DbClient adapter sharing the global pool. */
export function qClient(): DbClient {
  return {
    query: (text: string, params: unknown[] = []) => pool.query(text, params),
    q: <T = Row>(text: string, params: unknown[] = []) => q<T>(text, params),
    qOne: <T = Row>(text: string, params: unknown[] = []) => qOne<T>(text, params),
  };
}

function clientQ(c: pg.PoolClient, text: string, params: unknown[] = []) {
  return c.query(text, params as pg.QueryConfigValues<never[]>);
}

/**
 * Runs fn inside a single Postgres transaction (BEGIN/COMMIT/ROLLBACK).
 * All-or-nothing - used by checkout flows.
 */
export async function withTx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dbClient: DbClient = {
      query: (t: string, p?: unknown[]) => clientQ(client, t, p),
      q: async <R = Row>(t: string, p: unknown[] = []): Promise<R[]> => {
        const res = await clientQ(client, t, p);
        return mapRows<R>(res.rows as pg.QueryResultRow[]);
      },
      qOne: async <R = Row>(t: string, p: unknown[] = []): Promise<R | null> =>
        mapFirst<R>((await clientQ(client, t, p)).rows as pg.QueryResultRow[]),
    };
    const result = await fn(dbClient);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
