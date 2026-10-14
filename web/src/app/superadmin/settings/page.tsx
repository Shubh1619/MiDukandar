"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { saFetch } from "@/lib/superadmin-api";

const SETTING_FIELDS: Array<{ key: string; label: string; type: "boolean" | "number"; hint: string }> = [
  { key: "maintenance_mode", label: "Maintenance mode", type: "boolean", hint: "Blocks all tenant logins while enabled." },
  { key: "signup_enabled", label: "Signups enabled", type: "boolean", hint: "Allow new store registrations." },
  { key: "smtp_paused", label: "Pause transactional email", type: "boolean", hint: "Stops OTP / notification emails." },
  { key: "default_otp_expiry_minutes", label: "Default OTP expiry (minutes)", type: "number", hint: "Applies to newly requested OTPs." },
  { key: "default_otp_length", label: "Default OTP length", type: "number", hint: "Digits in newly issued OTPs." },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await saFetch<{ settings: Record<string, unknown> }>("/api/superadmin/settings");
      setSettings(res.settings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load settings");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setValue = (key: string, value: boolean | number) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!settings) return;
    const updates: Record<string, boolean | number> = {};
    for (const field of SETTING_FIELDS) {
      const v = settings[field.key];
      if (typeof v === "boolean" || typeof v === "number") updates[field.key] = v;
    }
    setSaving(true);
    try {
      const res = await saFetch<{ applied: Record<string, unknown> }>("/api/superadmin/settings", {
        method: "PATCH",
        body: { updates },
      });
      toast.success(`Saved ${Object.keys(res.applied).length} setting(s)`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Platform settings</h1>
        <p className="text-sm text-slate-500">Global flags that apply to every tenant.</p>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {SETTING_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-navy-900">{field.label}</p>
              <p className="text-xs text-slate-400">{field.hint}</p>
            </div>
            {field.type === "boolean" ? (
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(settings[field.key])}
                onClick={() => setValue(field.key, !Boolean(settings[field.key]))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  settings[field.key] ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    settings[field.key] ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            ) : (
              <input
                type="number"
                min={field.key.endsWith("length") ? 4 : 1}
                value={Number(settings[field.key] ?? 0)}
                onChange={(e) => setValue(field.key, Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-royal-500 focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save settings
      </button>
    </div>
  );
}