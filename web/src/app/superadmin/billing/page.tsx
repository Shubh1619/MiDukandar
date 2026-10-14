"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreditCard, Loader2, Settings2 } from "lucide-react";
import { saFetch } from "@/lib/superadmin-api";
import { formatINR, formatDateTime } from "@/lib/format";

interface BillingRow {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  planId: string | null;
  plan: string;
  planStatus: string;
  trialEndsAt: string | null;
  invoiceCount: number;
  totalRevenue: number;
  collected: number;
  outstanding: number;
  createdAt: string;
}

interface PlanOption {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
}

interface BillingResponse {
  summary: {
    tenants: number;
    active: number;
    suspended: number;
    onPaidPlan: number;
    totalRevenue: number;
  };
  plans: PlanOption[];
  tenants: BillingRow[];
}

export default function BillingPage() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [planId, setPlanId] = useState("");

  useEffect(() => {
    let active = true;
    const query = planId ? `?planId=${encodeURIComponent(planId)}` : "";
    saFetch<BillingResponse>(`/api/superadmin/billing${query}`)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "Failed to load subscriptions");
      });
    return () => {
      active = false;
    };
  }, [planId]);

  if (!data) return <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-navy-50 text-royal-600"><CreditCard className="size-5" /></span><div><h1 className="text-2xl font-bold text-navy-900">Subscriptions &amp; Billing</h1><p className="text-sm text-slate-500">Plan assignment and merchant invoice status per business.</p></div></div></div><Link href="/superadmin/plans" className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-royal-300 hover:text-royal-700"><Settings2 className="size-3.5" /> Manage plan definitions</Link></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{[
        { label: "Businesses", value: String(data.summary.tenants) },
        { label: "Active", value: String(data.summary.active) },
        { label: "Suspended", value: String(data.summary.suspended) },
        { label: "Paid plan", value: String(data.summary.onPaidPlan) },
        { label: "Merchant invoice revenue", value: formatINR(data.summary.totalRevenue) },
      ].map((card) => <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-lg font-bold text-navy-900">{card.value}</p><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{card.label}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-navy-900">Business subscriptions</h2><p className="text-xs text-slate-500">The plan column comes directly from the active plan catalog.</p></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-500">Filter plan<select value={planId} onChange={(event) => setPlanId(event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-navy-800"><option value="">All plans</option>{data.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Business</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Trial ends</th><th className="px-4 py-3 text-right">Invoice revenue</th><th className="px-4 py-3 text-right">Collected</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.tenants.map((tenant) => <tr key={tenant.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link href={`/superadmin/tenants/${tenant.id}`} className="font-medium text-navy-900 hover:text-royal-600">{tenant.name}</Link><p className="text-xs text-slate-400">{tenant.invoiceCount} invoices · joined {formatDateTime(tenant.createdAt)}</p></td><td className="px-4 py-3"><span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{tenant.plan}</span><span className="ml-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{tenant.planStatus.toLowerCase()}</span></td><td className="px-4 py-3 text-slate-600">{tenant.trialEndsAt ? formatDateTime(tenant.trialEndsAt) : "—"}</td><td className="px-4 py-3 text-right text-slate-700">{formatINR(tenant.totalRevenue)}</td><td className="px-4 py-3 text-right text-emerald-700">{formatINR(tenant.collected)}</td><td className="px-4 py-3 text-right text-red-700">{formatINR(tenant.outstanding)}</td><td className="px-4 py-3">{tenant.status === "ACTIVE" ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span> : <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Suspended</span>}</td></tr>)}</tbody></table></div>
    </div>
  );
}
