"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Store,
  CircleCheck,
  CircleOff,
  CreditCard,
  TrendingUp,
  Loader2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { saFetch } from "@/lib/superadmin-api";
import { formatINR } from "@/lib/format";

interface Summary {
  tenants: number;
  active: number;
  suspended: number;
  onPaidPlan: number;
  totalRevenue: number;
}

interface TenantRow {
  id: string;
  name: string;
  city: string | null;
  status: "ACTIVE" | "SUSPENDED";
  invoiceCount: number;
  lastActiveAt: string | null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const billing = await saFetch<{ summary: Summary }>("/api/superadmin/billing");
        const tenants = await saFetch<{ tenants: TenantRow[] }>("/api/superadmin/tenants?limit=5");
        if (!active) return;
        setSummary(billing.summary);
        setRecent(tenants.tenants);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading || !summary) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const cards = [
    { label: "Tenants", value: String(summary.tenants), icon: Store, tone: "text-navy-700 bg-navy-100" },
    { label: "Active", value: String(summary.active), icon: CircleCheck, tone: "text-emerald-700 bg-emerald-100" },
    { label: "Suspended", value: String(summary.suspended), icon: CircleOff, tone: "text-red-700 bg-red-100" },
    { label: "Paid plan", value: String(summary.onPaidPlan), icon: CreditCard, tone: "text-indigo-700 bg-indigo-100" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Platform overview across all tenants.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </span>
            <p className="text-lg font-bold text-navy-900">{c.value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-navy-900">Recently created tenants</h2>
          <Link
            href="/superadmin/tenants"
            className="inline-flex items-center gap-1 text-sm font-medium text-royal-600 hover:text-royal-700"
          >
            View all <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No tenants yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-navy-700">
                    <Store className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-navy-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.city ?? "—"} · {t.invoiceCount} invoices</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {t.status === "SUSPENDED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      <ShieldAlert className="h-3 w-3" /> Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                  <Link
                    href={`/superadmin/tenants/${t.id}`}
                    className="text-sm font-medium text-royal-600 hover:text-royal-700"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}