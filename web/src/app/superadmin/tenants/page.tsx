"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Store, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { saFetch } from "@/lib/superadmin-api";
import { formatDateTime } from "@/lib/format";

interface TenantRow {
  id: string;
  name: string;
  type: string;
  city: string | null;
  status: "ACTIVE" | "SUSPENDED";
  plan: string;
  planStatus: string;
  ownerEmail: string | null;
  invoiceCount: number;
  customerCount: number;
  productCount: number;
  userCount: number;
  lastActiveAt: string | null;
  createdAt: string;
}

interface ListResponse {
  total: number;
  page: number;
  limit: number;
  tenants: TenantRow[];
}

export default function TenantsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "">("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      const res = await saFetch<ListResponse>(`/api/superadmin/tenants?${params.toString()}`);
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void load();
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Tenants</h1>
          <p className="text-sm text-slate-500">{data ? `${data.total} stores on the platform` : "Loading…"}</p>
        </div>
      </div>

      <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by store name, city or owner email…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-100"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-royal-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Records</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3 text-right">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && data && data.tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <Store className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  No tenants match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              data?.tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/superadmin/tenants/${t.id}`} className="font-medium text-navy-900 hover:text-royal-600">
                      {t.name}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {t.type} · {t.city ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.ownerEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.invoiceCount} inv · {t.productCount} prods · {t.customerCount} custs
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {t.plan} / {t.planStatus.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {t.status === "ACTIVE" ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(t.lastActiveAt)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatDateTime(t.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {data?.page ?? 1} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}