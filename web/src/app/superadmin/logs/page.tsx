"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saFetch } from "@/lib/superadmin-api";
import { formatDateTime } from "@/lib/format";

interface SuperadminLog {
  id: string;
  action: string;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  superadminEmail: string | null;
  superadminName: string | null;
  tenantName: string | null;
}

interface TenantLog {
  id: string;
  action: string;
  detail: unknown;
  ip: string | null;
  createdAt: string;
  tenantName: string | null;
  userEmail: string | null;
}

interface LogsResponse {
  superadminLogs: SuperadminLog[];
  tenantLogs: TenantLog[];
}

export default function LogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saFetch<LogsResponse>("/api/superadmin/logs?limit=100");
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Audit logs</h1>
        <p className="text-sm text-slate-500">Platform (superadmin) actions and cross-tenant activity.</p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-navy-900">Superadmin actions</h2>
        {data.superadminLogs.length === 0 ? (
          <p className="text-sm text-slate-400">No platform actions yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.superadminLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2.5 font-medium text-navy-900">{l.superadminEmail ?? "system"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{l.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{l.tenantName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.reason ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-400">{l.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-navy-900">Tenant activity</h2>
        {data.tenantLogs.length === 0 ? (
          <p className="text-sm text-slate-400">No tenant activity logged yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.tenantLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.tenantName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.userEmail ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{l.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {l.detail ? JSON.stringify(l.detail).slice(0, 120) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}