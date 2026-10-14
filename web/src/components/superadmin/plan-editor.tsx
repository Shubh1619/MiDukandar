"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saFetch } from "@/lib/superadmin-api";
import {
  PLAN_LIMIT_LABELS,
  PLAN_MODULE_GROUPS,
  PLAN_MODULE_LABELS,
  type PlanDefinition,
  type PlanModuleKey,
} from "@/lib/plan-catalog";

type ModuleForm = { enabled: boolean; limitValue: number | null };

type PlanForm = {
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  trialDays: number;
  displayOrder: number;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  isPopular: boolean;
  adsEnabled: boolean;
  adsTier: "STANDARD" | "MINIMAL";
  supportTier: string;
  customFeatures: string;
  modules: Record<PlanModuleKey, ModuleForm>;
};

type PlanEditorProps = {
  open: boolean;
  plan: PlanDefinition | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (plan: PlanDefinition) => void;
};

const moduleKeys = PLAN_MODULE_GROUPS.flatMap((group) => group.modules);

function defaultModules(): Record<PlanModuleKey, ModuleForm> {
  return moduleKeys.reduce((result, key) => {
    result[key] = {
      enabled: ["DASHBOARD", "BILLING", "PRODUCTS", "INVENTORY", "SALES_INVOICES", "CUSTOMERS_UDHAARI"].includes(key),
      limitValue: key === "PRODUCTS" ? 25 : key === "USERS_ROLES" || key === "MULTI_STORE" ? 1 : null,
    };
    return result;
  }, {} as Record<PlanModuleKey, ModuleForm>);
}

function toForm(plan: PlanDefinition | null): PlanForm {
  const modules = defaultModules();
  plan?.modules.forEach((module) => {
    modules[module.moduleKey] = { enabled: module.enabled, limitValue: module.limitValue };
  });
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    priceMonthly: plan?.priceMonthly ?? 0,
    priceYearly: plan?.priceYearly ?? 0,
    trialDays: plan?.trialDays ?? 14,
    displayOrder: plan?.displayOrder ?? 0,
    status: plan?.status ?? "DRAFT",
    isPopular: plan?.isPopular ?? false,
    adsEnabled: plan?.adsEnabled ?? true,
    adsTier: plan?.adsTier ?? "STANDARD",
    supportTier: plan?.supportTier ?? "Standard",
    customFeatures: plan?.customFeatures.join("\n") ?? "",
    modules,
  };
}

export default function PlanEditor({ open, plan, onOpenChange, onSaved }: PlanEditorProps) {
  const [form, setForm] = useState<PlanForm>(() => toForm(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yearlySavings = useMemo(() => {
    if (form.priceMonthly <= 0) return 0;
    return Math.max(0, Math.round((1 - form.priceYearly / (form.priceMonthly * 12)) * 100));
  }, [form.priceMonthly, form.priceYearly]);

  const update = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const updateModule = (moduleKey: PlanModuleKey, patch: Partial<ModuleForm>) => {
    setForm((current) => ({
      ...current,
      modules: { ...current.modules, [moduleKey]: { ...current.modules[moduleKey], ...patch } },
    }));
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Plan name is required.");
      return;
    }
    if (form.priceMonthly < 0 || form.priceYearly < 0) {
      setError("Prices must be zero or greater.");
      return;
    }
    if (!Object.values(form.modules).some((module) => module.enabled)) {
      setError("Enable at least one module.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await saFetch<{ plan: PlanDefinition }>(plan ? `/api/superadmin/plans/${plan.id}` : "/api/superadmin/plans", {
        method: plan ? "PATCH" : "POST",
        body: {
          name: form.name.trim(),
          description: form.description.trim(),
          priceMonthly: form.priceMonthly,
          priceYearly: form.priceYearly,
          trialDays: form.trialDays,
          displayOrder: form.displayOrder,
          status: form.status,
          isPopular: form.isPopular,
          adsEnabled: form.adsEnabled,
          adsTier: form.adsTier,
          supportTier: form.supportTier.trim(),
          customFeatures: form.customFeatures.split("\n").map((feature) => feature.trim()).filter(Boolean),
          modules: Object.entries(form.modules).map(([moduleKey, module]) => ({
            moduleKey,
            enabled: module.enabled,
            limitValue: module.limitValue,
          })),
        },
      });
      toast.success(plan ? "Plan updated." : "Plan created.");
      onSaved(response.plan);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save plan.");
      toast.error(err instanceof Error ? err.message : "Could not save plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg">{plan ? "Edit plan" : "Create new plan"}</DialogTitle>
          <DialogDescription>Plan definitions control pricing, module enforcement and ad visibility.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6 px-5 py-5 sm:px-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sparkles className="size-4 text-royal-600" aria-hidden />
              <h3 className="font-display text-base font-bold text-navy-900">Basic information</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="plan-name">Plan name *</Label>
                <Input id="plan-name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Pro" required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="plan-description">Description</Label>
                <Textarea id="plan-description" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Shown on the public pricing page." rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-monthly">Monthly price (₹) *</Label>
                <Input id="plan-monthly" type="number" min={0} step="0.01" value={form.priceMonthly} onChange={(event) => update("priceMonthly", Number(event.target.value))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-yearly">Yearly price (₹) *</Label>
                <Input id="plan-yearly" type="number" min={0} step="0.01" value={form.priceYearly} onChange={(event) => update("priceYearly", Number(event.target.value))} required />
                <p className="text-[11px] text-slate-400">{yearlySavings > 0 ? `Saves ${yearlySavings}% vs monthly × 12. Edit to override.` : "Enter 0 for contact sales or a free plan."}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-trial">Trial period (days)</Label>
                <Input id="plan-trial" type="number" min={0} value={form.trialDays} onChange={(event) => update("trialDays", Number(event.target.value))} />
                <p className="text-[11px] text-slate-400">0 = no trial.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-order">Display order</Label>
                <Input id="plan-order" type="number" min={0} value={form.displayOrder} onChange={(event) => update("displayOrder", Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-status">Status</Label>
                <select id="plan-status" value={form.status} onChange={(event) => update("status", event.target.value as PlanForm["status"])} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 sm:col-span-2">
                <div><Label htmlFor="plan-popular">Most popular</Label><p className="text-[11px] text-slate-400">Highlights this plan on the public pricing page.</p></div>
                <Switch id="plan-popular" checked={form.isPopular} onCheckedChange={(checked) => update("isPopular", checked)} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="border-b border-slate-100 pb-2"><h3 className="font-display text-base font-bold text-navy-900">Module-wise access</h3><p className="mt-1 text-xs text-slate-500">These flags are the backend enforcement source of truth.</p></div>
            <div className="space-y-4">
              {PLAN_MODULE_GROUPS.map((group) => <div key={group.key} className="rounded-xl border border-slate-200 p-3"><p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{group.label}</p><div className="grid gap-2 sm:grid-cols-2">{group.modules.map((moduleKey) => { const moduleConfig = form.modules[moduleKey]; const limitLabel = PLAN_LIMIT_LABELS[moduleKey]; return <div key={moduleKey} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${moduleConfig.enabled ? "border-royal-200 bg-royal-50/40" : "border-slate-100 bg-slate-50/60"}`}><div className="min-w-0"><Label htmlFor={`module-${moduleKey}`} className="cursor-pointer text-sm">{PLAN_MODULE_LABELS[moduleKey]}</Label>{limitLabel && <Input aria-label={`${limitLabel} for ${PLAN_MODULE_LABELS[moduleKey]}`} type="number" min={0} value={moduleConfig.limitValue ?? 0} disabled={!moduleConfig.enabled} onChange={(event) => updateModule(moduleKey, { limitValue: Math.max(0, Number(event.target.value) || 0) })} className="mt-1.5 h-7 w-28 text-xs" />}</div><Switch id={`module-${moduleKey}`} checked={moduleConfig.enabled} onCheckedChange={(checked) => updateModule(moduleKey, { enabled: checked })} /></div>; })}</div></div>)}
            </div>
            <p className="text-[11px] text-slate-400">For Products, Users &amp; Roles and Multi-Store, 0 means unlimited.</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-base font-bold text-navy-900">Ads configuration</h3><p className="mt-1 text-xs text-slate-500">Controls the AdBanner visibility for this plan.</p></div><Switch checked={form.adsEnabled} onCheckedChange={(checked) => update("adsEnabled", checked)} aria-label="Show ads on this plan" /></div><div className="mt-4 space-y-1.5"><Label htmlFor="ads-tier">Ad density</Label><select id="ads-tier" disabled={!form.adsEnabled} value={form.adsTier} onChange={(event) => update("adsTier", event.target.value as PlanForm["adsTier"])} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-50"><option value="STANDARD">Standard</option><option value="MINIMAL">Minimal</option></select></div></div>
            <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-display text-base font-bold text-navy-900">Support &amp; extras</h3><div className="mt-3 space-y-1.5"><Label htmlFor="support-tier">Support tier</Label><Input id="support-tier" value={form.supportTier} onChange={(event) => update("supportTier", event.target.value)} placeholder="Standard, Priority, Dedicated…" /></div><div className="mt-3 space-y-1.5"><Label htmlFor="custom-features">Custom features</Label><Textarea id="custom-features" value={form.customFeatures} onChange={(event) => update("customFeatures", event.target.value)} placeholder="One feature per line" rows={3} /></div></div>
          </section>

          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="sticky bottom-0 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 bg-white py-3 sm:flex-row"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{plan ? "Save changes" : "Create plan"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
