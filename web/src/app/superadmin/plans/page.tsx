"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Copy, Edit3, ExternalLink, Layers3, Loader2, Plus, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatINR } from "@/lib/format";
import { saFetch } from "@/lib/superadmin-api";
import type { PlanDefinition, PlanStatus } from "@/lib/plan-catalog";
import PlanEditor from "@/components/superadmin/plan-editor";

type Filter = "ALL" | PlanStatus;

type PlansResponse = { plans: PlanDefinition[] };

const filters: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "All plans" },
  { key: "ACTIVE", label: "Active" },
  { key: "DRAFT", label: "Draft" },
  { key: "ARCHIVED", label: "Archived" },
];

function statusVariant(status: PlanStatus) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "DRAFT") return "secondary" as const;
  return "outline" as const;
}

export default function PlansPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanDefinition | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = filter === "ALL" ? "" : `?status=${filter}`;
      const response = await saFetch<PlansResponse>(`/api/superadmin/plans${query}`);
      setPlans(response.plans);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    let active = true;
    const query = filter === "ALL" ? "" : `?status=${filter}`;
    saFetch<PlansResponse>(`/api/superadmin/plans${query}`)
      .then((response) => {
        if (active) setPlans(response.plans);
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load plans.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter]);

  const openCreate = () => {
    setEditingPlan(null);
    setEditorOpen(true);
  };

  const openEdit = (plan: PlanDefinition) => {
    setEditingPlan(plan);
    setEditorOpen(true);
  };

  const handleSaved = () => {
    setEditorOpen(false);
    void load();
    toast.success("Plan catalog updated.");
  };

  const duplicate = async (plan: PlanDefinition) => {
    setBusyId(plan.id);
    try {
      const response = await saFetch<{ plan: PlanDefinition }>(`/api/superadmin/plans/${plan.id}/duplicate`, { method: "POST", body: {} });
      toast.success("Plan duplicated as a draft.");
      await load();
      setEditingPlan(response.plan);
      setEditorOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate plan.");
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (plan: PlanDefinition) => {
    if (!window.confirm(`Archive ${plan.name}? Existing businesses will keep their current assignment until support changes it.`)) return;
    setBusyId(plan.id);
    try {
      await saFetch(`/api/superadmin/plans/${plan.id}/status`, { method: "PATCH", body: { status: "ARCHIVED" } });
      toast.success("Plan archived.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not archive plan.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-navy-50 text-royal-600"><Layers3 className="size-5" aria-hidden /></span>
            <div><h1 className="text-2xl font-bold text-navy-900">Plans &amp; Subscription</h1><p className="text-sm text-slate-500">Manage plan definitions, module access and ad visibility.</p></div>
          </div>
        </div>
        <div className="flex items-center gap-2"><Link href="/pricing" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-royal-300 hover:text-royal-700">View public pricing <ExternalLink className="size-3.5" /></Link><Button onClick={openCreate}><Plus className="size-4" /> Create new plan</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total plans</p><p className="mt-1 text-2xl font-bold text-navy-900">{plans.length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active businesses</p><p className="mt-1 text-2xl font-bold text-navy-900">{plans.reduce((sum, plan) => sum + (plan.activeBusinessCount ?? 0), 0)}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Public visibility</p><p className="mt-1 text-2xl font-bold text-navy-900">{plans.filter((plan) => plan.status === "ACTIVE").length}</p></div></div>

      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{filters.map((item) => <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === item.key ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-800"}`}>{item.label}</button>)}</div><p className="text-xs text-slate-400">Active businesses on an archived plan remain assigned until an admin changes them.</p></div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Pricing</th><th className="px-4 py-3 text-right">Businesses</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ads</th><th className="px-4 py-3 text-right">Modules</th><th className="px-4 py-3">Last edited</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400"><Loader2 className="mx-auto size-5 animate-spin" /></td></tr>}{!loading && plans.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No plans match this filter.</td></tr>}{!loading && plans.map((plan) => <tr key={plan.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="flex items-center gap-2"><span className="font-semibold text-navy-900">{plan.name}</span>{plan.isPopular && <Badge className="bg-royal-50 text-royal-700 hover:bg-royal-50">Popular</Badge>}</div><p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{plan.description || "No description"}</p></td><td className="px-4 py-3"><p className="font-semibold text-navy-900">{formatINR(plan.priceMonthly)} / month</p><p className="text-xs text-slate-400">{formatINR(plan.priceYearly)} / year</p></td><td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 font-semibold text-navy-900"><Users className="size-3.5 text-slate-400" />{plan.activeBusinessCount ?? 0}</span></td><td className="px-4 py-3"><Badge variant={statusVariant(plan.status)}>{plan.status === "ACTIVE" ? "Active" : plan.status === "DRAFT" ? "Draft" : "Archived"}</Badge></td><td className="px-4 py-3">{plan.adsEnabled ? <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Enabled · {plan.adsTier.toLowerCase()}</Badge> : <Badge variant="secondary">Disabled</Badge>}</td><td className="px-4 py-3 text-right font-semibold text-navy-900">{plan.moduleCount ?? plan.modules.filter((module) => module.enabled).length}</td><td className="px-4 py-3 text-slate-500">{formatDateTime(plan.updatedAt)}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" title="Edit plan" onClick={() => openEdit(plan)} className="rounded-lg p-2 text-slate-500 hover:bg-royal-50 hover:text-royal-700"><Edit3 className="size-4" /></button><button type="button" title="Duplicate plan" disabled={busyId === plan.id} onClick={() => void duplicate(plan)} className="rounded-lg p-2 text-slate-500 hover:bg-royal-50 hover:text-royal-700 disabled:opacity-40"><Copy className="size-4" /></button>{plan.status !== "ARCHIVED" && <button type="button" title="Archive plan" disabled={busyId === plan.id} onClick={() => void archive(plan)} className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"><Archive className="size-4" /></button>}</div></td></tr>)}</tbody></table></div></div>

      <PlanEditor key={editingPlan?.id ?? "new"} open={editorOpen} plan={editingPlan} onOpenChange={setEditorOpen} onSaved={handleSaved} />
    </div>
  );
}
