import pg from "pg";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

// NUMERIC/OID 1700 → number; INT8/OID 20 → number (counts, sequences)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  logger.error("pg: pool error", { error: err.message });
});

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
  const res = await pool.query(text, params as pg.QueryConfigValues<never[]>);
  return mapRows<T>(res.rows as pg.QueryResultRow[]);
}

/** Runs a query, returns the first mapped row or null. */
export async function qOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Runs a write query, returns rowCount. */
export async function qExec(text: string, params: unknown[] = []): Promise<number> {
  const res = await pool.query(text, params as pg.QueryConfigValues<never[]>);
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
    query: (text: string, params: unknown[] = []) =>
      pool.query(text, params as pg.QueryConfigValues<never[]>),
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