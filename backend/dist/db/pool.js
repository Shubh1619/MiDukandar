import pg from "pg";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
// NUMERIC/OID 1700 → number; INT8/OID 20 → number (counts, sequences)
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// DATE/OID 1082 → keep the raw "YYYY-MM-DD". pg's default parser builds a Date
// at LOCAL midnight, which a UTC/IST offset then shifts a day when serialized.
pg.types.setTypeParser(1082, (v) => (v === null ? null : v));
export const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});
pool.on("error", (err) => {
    logger.error("pg: pool error", { error: err.message });
});
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export function toCamel(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
        out[camel(k)] = v;
        out[k] = v;
    }
    return out;
}
export function mapRows(rows) {
    return rows.map((r) => toCamel(r));
}
export function mapFirst(rows) {
    return rows.length ? toCamel(rows[0]) : null;
}
/** Runs a query, returns mapped (camelCase, numbers) rows. */
export async function q(text, params = []) {
    const res = await pool.query(text, params);
    return mapRows(res.rows);
}
/** Runs a query, returns the first mapped row or null. */
export async function qOne(text, params = []) {
    const rows = await q(text, params);
    return rows[0] ?? null;
}
/** Runs a write query, returns rowCount. */
export async function qExec(text, params = []) {
    const res = await pool.query(text, params);
    return res.rowCount ?? 0;
}
/** Pool-bound DbClient adapter sharing the global pool. */
export function qClient() {
    return {
        query: (text, params = []) => pool.query(text, params),
        q: (text, params = []) => q(text, params),
        qOne: (text, params = []) => qOne(text, params),
    };
}
function clientQ(c, text, params = []) {
    return c.query(text, params);
}
/**
 * Runs fn inside a single Postgres transaction (BEGIN/COMMIT/ROLLBACK).
 * All-or-nothing - used by checkout flows.
 */
export async function withTx(fn) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const dbClient = {
            query: (t, p) => clientQ(client, t, p),
            q: async (t, p = []) => {
                const res = await clientQ(client, t, p);
                return mapRows(res.rows);
            },
            qOne: async (t, p = []) => mapFirst((await clientQ(client, t, p)).rows),
        };
        const result = await fn(dbClient);
        await client.query("COMMIT");
        return result;
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
        client.release();
    }
}
export async function pingDb() {
    try {
        await pool.query("SELECT 1");
        return true;
    }
    catch {
        return false;
    }
}
