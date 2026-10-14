export function snake(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export interface UpdateWhere {
  id: string;
  storeId?: string;
}

/**
 * Builds a dynamic `UPDATE <table> SET ... ... RETURNING *` statement from an
 * already-transformed list of [column, value] entries. Returns SQL + params,
 * or null when there is nothing to update.
 */
export function buildUpdate(
  table: string,
  entries: Array<[string, unknown]>,
  where: UpdateWhere,
): { sql: string; params: unknown[] } | null {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of entries) {
    if (v === undefined) continue;
    params.push(v);
    sets.push(`${snake(k)} = $${params.length}`);
  }
  if (sets.length === 0) return null;
  params.push(where.id);
  let sql = `UPDATE ${table} SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`;
  if (where.storeId) {
    params.push(where.storeId);
    sql += ` AND store_id = $${params.length}`;
  }
  return { sql: sql + " RETURNING *", params };
}