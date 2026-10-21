import { TtlCache } from "./ttl-cache.js";
import type { DashboardStats } from "../services/report.service.js";

/**
 * Short-lived cache for the composed dashboard summary.
 *
 * The web dashboard polls `/api/reports/dashboard` every 30s and the mobile app
 * refetches on resume; each call fans out to nine aggregate queries. A short TTL
 * absorbs bursts (multiple tabs, fast re-navigation, focus refreshes) while any
 * write that changes a KPI invalidates the entry immediately via
 * `invalidateDashboardCache`.
 */
const DASHBOARD_TTL_MS = 5_000;

export type DashboardSummary = { stats: DashboardStats; from: string; to: string };

export const dashboardCache = new TtlCache<DashboardSummary>(DASHBOARD_TTL_MS);

/**
 * Drops cached dashboard summaries. Called after any write that changes a KPI
 * (sales, purchases, expenses, payments, stock). Omitting `storeId` clears
 * every store.
 */
export function invalidateDashboardCache(storeId?: string): void {
  if (!storeId) {
    dashboardCache.clear();
    return;
  }
  dashboardCache.deleteKeysWithPrefix(`${storeId}|`);
}
