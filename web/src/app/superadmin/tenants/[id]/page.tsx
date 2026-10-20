"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Store, Loader2, ShieldAlert, ShieldCheck, ExternalLink, User, Layers3, SlidersHorizontal } from "lucide-react";
import { saFetch } from "@/lib/superadmin-api";
import { cn } from "@/lib/utils";
import { formatINR, formatDateTime } from "@/lib/format";
import type { PlanDefinition } from "@/lib/plan-catalog";

interface AccessFeature {
  key: string;
  label: string;
  enabled: boolean;
}

interface AccessPage {
  key: string;
  label: string;
  moduleKey: string | null;
  includedInPlan: boolean;
  enabled: boolean;
  features: AccessFeature[];
}

function buildAccessOverrides(pages: AccessPage[]): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const page of pages) {
    if (!page.includedInPlan) continue;
    next[page.key] = page.enabled;
    for (const feature of page.features) next[feature.key] = feature.enabled;
  }
  return next;
}

interface Detail {
  store: Record<string, unknown> & {
    id: string;
    name: string;
    type: string;
    city: string | null;
    state: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    gst: string | null;
    status: "ACTIVE" | "SUSPENDED";
    plan: string;
    planId: string | null;
    planName?: string | null;
    planDefinitionStatus?: string | null;
    planStatus: string;
    trialEndsAt: string | null;
    suspendedAt: string | null;
    suspendedReason: string | null;
    createdAt: string;
    ownerEmail: string | null;
  };
  stats: {
    invoiceCount: number;
    totalRevenue: number;
    collected: number;
    outstanding: number;
    customerCount: number;
    productCount: number;
    userCount: number;
  };
  recentSales: Array<Record<string, unknown> & {
    id: string;
    invoiceNumber: string;
    total: number;
    paidAmount: number;
    paymentMode: string;
    status: string;
    createdAt: string;
  }>;
}

interface TenantUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [planId, setPlanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [accessPlanName, setAccessPlanName] = useState<string | null>(null);
  const [accessPages, setAccessPages] = useState<AccessPage[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [accessSaving, setAccessSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, u, p, a] = await Promise.all([
        saFetch<Detail>(`/api/superadmin/tenants/${id}`),
        saFetch<{ users: TenantUser[] }>(`/api/superadmin/tenants/${id}/users`),
        saFetch<{ plans: PlanDefinition[] }>(`/api/superadmin/plans`),
        saFetch<{ planName: string | null; pages: AccessPage[] }>(`/api/superadmin/tenants/${id}/access`),
      ]);
      const assignablePlans = p.plans.filter((plan) => plan.status === "ACTIVE");
      setDetail(d);
      setUsers(u.users);
      setPlans(assignablePlans);
      setPlanId(assignablePlans.some((plan) => plan.id === d.store.planId) ? d.store.planId ?? "" : "");
      setAccessPlanName(a.planName);
      setAccessPages(a.pages);
      setOverrides(buildAccessOverrides(a.pages));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submitStatus = async (action: "SUSPEND" | "ACTIVATE") => {
    setBusy(true);
    try {
      await saFetch(`/api/superadmin/tenants/${id}/status`, {
        method: "PATCH",
        body: { action },
      });
      toast.success(action === "SUSPEND" ? "Tenant suspended." : "Tenant activated.");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const overridePlan = async () => {
    if (!planId) {
      toast.error("Select a plan first.");
      return;
    }
    setPlanSaving(true);
    try {
      await saFetch(`/api/superadmin/tenants/${id}/plan`, {
        method: "PATCH",
        body: { planId },
      });
      toast.success("Business plan updated.");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plan override failed");
    } finally {
      setPlanSaving(false);
    }
  };

  const setOverride = (key: string, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const saveAccess = async () => {
    setAccessSaving(true);
    try {
      const res = await saFetch<{ pages: AccessPage[] }>(`/api/superadmin/tenants/${id}/access`, {
        method: "PUT",
        body: { access: overrides },
      });
      setAccessPages(res.pages);
      setOverrides(buildAccessOverrides(res.pages));
      toast.success("Page & feature access updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Access update failed");
    } finally {
      setAccessSaving(false);
    }
  };

  const impersonate = async () => {
    setImpersonating(true);
    try {
      const res = await saFetch<{ accessToken: string; expiresInSeconds: number; tenant: { id: string; name: string }; user: { email: string } }>(
        `/api/superadmin/tenants/${id}/impersonate`,
        { method: "POST", body: {} },
      );
      const handoff = encodeURIComponent(
        JSON.stringify({
          accessToken: res.accessToken,
          tenantName: res.tenant.name,
          expiresAt: Date.now() + res.expiresInSeconds * 1000,
          by: res.user.email,
        }),
      );
      window.open(`/impersonate#${handoff}`, "_blank", "noopener,noreferrer");
      toast.success("Impersonation session created — opened tenant console.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impersonation failed");
    } finally {
      setImpersonating(false);
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const s = detail.store;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100 text-navy-700">
            <Store className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold text-navy-900">{s.name}</h1>
          {s.status === "ACTIVE" ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
          ) : (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Suspended</span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {s.type} · {[s.address, s.city, s.state].filter(Boolean).join(", ") || "—"} · created {formatDateTime(s.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Invoices", value: String(detail.stats.invoiceCount) },
          { label: "Revenue", value: formatINR(detail.stats.totalRevenue) },
          { label: "Collected", value: formatINR(detail.stats.collected) },
          { label: "Outstanding", value: formatINR(detail.stats.outstanding) },
          { label: "Products", value: String(detail.stats.productCount) },
          { label: "Customers", value: String(detail.stats.customerCount) },
          { label: "Staff users", value: String(detail.stats.userCount) },
          { label: "Plan", value: `${s.plan} / ${s.planStatus.toLowerCase()}` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-lg font-bold text-navy-900">{c.value}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-royal-50 text-royal-600"><Layers3 className="size-4" /></span><div><h2 className="font-semibold text-navy-900">Plan assignment</h2><p className="mt-1 text-xs text-slate-500">Change this business&apos;s plan without going through checkout.</p></div></div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">Current: {s.plan}</span>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5"><label htmlFor="tenant-plan" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</label><select id="tenant-plan" value={planId} onChange={(event) => setPlanId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy-900"><option value="">Select a plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.status !== "ACTIVE" ? ` (${plan.status.toLowerCase()})` : ""}</option>)}</select></div>
            <button type="button" onClick={() => void overridePlan()} disabled={planSaving || !planId || planId === s.planId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50">{planSaving && <Loader2 className="size-4 animate-spin" />}Override plan</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-royal-50 text-royal-600">
              <SlidersHorizontal className="size-4" />
            </span>
            <div>
              <h2 className="font-semibold text-navy-900">Pages &amp; features</h2>
              <p className="mt-1 text-xs text-slate-500">
                Turn app pages and features off for this business. Plan-included pages can be restricted here.
              </p>
            </div>
          </div>
          {accessPlanName && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{accessPlanName}</span>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {accessPages.map((page) => {
            const pageOn = overrides[page.key] ?? true;
            return (
              <div
                key={page.key}
                className={cn(
                  "rounded-lg border p-3",
                  page.includedInPlan ? "border-slate-200" : "border-slate-100 bg-slate-50",
                )}
              >
                <label className="flex items-center gap-2 text-sm font-medium text-navy-900">
                  <input
                    type="checkbox"
                    checked={page.includedInPlan && pageOn}
                    disabled={!page.includedInPlan}
                    onChange={(e) => setOverride(page.key, e.target.checked)}
                    className="size-4 rounded border-slate-300 text-royal-600 focus:ring-royal-500"
                  />
                  <span className="truncate">{page.label}</span>
                  {!page.includedInPlan && (
                    <span className="ml-auto shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Not in plan
                    </span>
                  )}
                </label>
                {page.features.length > 0 && (
                  <div className="mt-2 space-y-1 pl-6">
                    {page.features.map((feature) => (
                      <label key={feature.key} className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={page.includedInPlan && pageOn && (overrides[feature.key] ?? true)}
                          disabled={!page.includedInPlan || !pageOn}
                          onChange={(e) => setOverride(feature.key, e.target.checked)}
                          className="size-3.5 rounded border-slate-300 text-royal-600 focus:ring-royal-500"
                        />
                        <span className="truncate">{feature.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={saveAccess}
            disabled={accessSaving}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {accessSaving && <Loader2 className="size-4 animate-spin" />}
            Save access
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy-900">Information</h2>
          <dl className="space-y-2 text-sm">
            {(
              [
                ["Phone", s.phone],
                ["Email", s.email],
                ["GST", s.gst],
                ["Owner", s.ownerEmail],
                ["Trial ends", s.trialEndsAt ? formatDateTime(s.trialEndsAt) : "—"],
                ["Suspended at", s.suspendedAt ? formatDateTime(s.suspendedAt) : "—"],
                ["Suspension reason", s.suspendedReason],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="shrink-0 font-medium text-slate-500">{k}</dt>
                <dd className="text-right text-slate-800">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-navy-900">Platform actions</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await impersonate();
                } finally {
                  setBusy(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
            >
              {impersonating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Impersonate tenant
            </button>
            {s.status === "ACTIVE" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => submitStatus("SUSPEND")}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                <ShieldAlert className="h-4 w-4" /> Suspend
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => submitStatus("ACTIVATE")}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" /> Activate
              </button>
            )}
          </div>
          {s.status === "SUSPENDED" && (
            <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
              Suspended tenants cannot log in and cannot be impersonated.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-navy-900">Staff users</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {users.length === 0 && <li className="px-5 py-6 text-sm text-slate-400">No users.</li>}
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-navy-700">
                    <User className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-navy-900">{u.name ?? u.email}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{u.role}</span>
                  {!u.isActive && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Inactive</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-navy-900">Recent invoices</h2>
          </div>
          {detail.recentSales.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No sales yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {detail.recentSales.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{r.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(r.createdAt)} · {r.paymentMode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-navy-900">{formatINR(r.total)}</p>
                    <p className="text-xs text-slate-400">{r.status.toLowerCase()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}