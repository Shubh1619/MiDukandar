"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, MapPin, ShieldCheck, Store as StoreIcon } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import type { Store } from "@/lib/types";
import { MobileInput } from "@/components/ui/mobile-input";

const STORE_TYPES = [
  "Kirana & General Store",
  "Supermarket / Grocery",
  "Convenience Store",
  "Department Store",
  "Pharmacy / Medical Store",
  "Fruits & Vegetables",
  "Bakery & Dairy",
  "Meat & Poultry Shop",
  "Sweet Shop / Confectionery",
  "Tea / Coffee Shop",
  "Restaurant / Café",
  "Electronics & Appliances",
  "Mobile & Accessories",
  "Computers & Laptops",
  "Clothing & Fashion",
  "Footwear",
  "Jewelry",
  "Beauty & Cosmetics",
  "Furniture & Home Decor",
  "Kitchenware & Utensils",
  "Hardware & Tools",
  "Paint & Home Improvement",
  "Electrical & Lighting",
  "Plumbing & Sanitary",
  "Cement & Construction Materials",
  "Stationery & Books",
  "Toys & Games",
  "Sports & Fitness Equipment",
  "Pet Store",
  "Optical Store",
  "Luggage & Bags",
  "Gift & Novelty",
  "Art & Craft Supplies",
  "Auto Parts & Accessories",
  "Two-Wheeler Showroom / Service",
  "Florist",
  "Tailoring & Alterations",
  "Wholesale / Distributor",
  "Service Provider / Salon",
  "Other Retail",
];

const LANGUAGES: Record<string, string> = { en: "English", hi: "हिन्दी", mr: "मराठी" };

const US_STATES = [
  "Maharashtra",
  "Karnataka",
  "Gujarat",
  "Delhi",
  "Tamil Nadu",
  "Telangana",
  "Madhya Pradesh",
  "Rajasthan",
  "Uttar Pradesh",
  "West Bengal",
  "Other",
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-navy-400">{label}</label>
        {hint ? <span className="text-[11px] text-navy-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-navy-200 bg-white px-3 font-display text-sm text-navy-900 outline-none transition-colors focus:border-navy-500";

export default function OnboardPage() {
  const router = useRouter();
  const { ready, user, store, init, setStore } = useAuth();

  const [form, setForm] = useState({
    email: "",
    ownerName: "",
    name: "",
    type: STORE_TYPES[0],
    address: "",
    city: "",
    state: "Maharashtra",
    pincode: "",
    phone: "",
    gst: "",
    currency: "INR",
    language: "hi",
    invoicePrefix: "INV",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!ready) return;
    if (user && store) router.replace("/dashboard");
  }, [ready, user, store, router]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const isRegistration = !user;

  const submit = async () => {
    if (isRegistration) {
      const address = form.email.trim().toLowerCase();
      if (!address) {
        setError("Enter an email address for your account.");
        return;
      }
      if (!EMAIL_RE.test(address)) {
        setError("Enter a valid email address.");
        return;
      }
      if (form.ownerName.trim().length < 2) {
        setError("Enter the shop owner's name");
        return;
      }
    }
    if (form.name.trim().length < 2) {
      setError("Enter your shop name");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (isRegistration) {
        await apiFetch("/api/auth/register", {
          method: "POST",
          noAuth: true,
          body: {
            email: form.email.trim().toLowerCase(),
            ownerName: form.ownerName.trim(),
            name: form.name.trim(),
            type: form.type,
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state,
            pincode: form.pincode.trim(),
            phone: form.phone.trim(),
            gst: form.gst.trim(),
            currency: form.currency,
            language: form.language,
            invoicePrefix: form.invoicePrefix.trim() || "INV",
          },
        });
        toast.success("Account created - sign in to continue");
        router.replace("/login");
        return;
      }
      const data = await apiFetch<{ store: Store }>("/api/store/setup", {
        method: "POST",
        body: {
          name: form.name.trim(),
          type: form.type,
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state,
          pincode: form.pincode.trim(),
          phone: form.phone.trim(),
          gst: form.gst.trim(),
          currency: form.currency,
          language: form.language,
          invoicePrefix: form.invoicePrefix.trim() || "INV",
        },
      });
      setStore(data.store);
      toast.success("Store created - welcome to MiDukandar!");
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError && err.message && err.message !== `HTTP ${err.status}`
          ? err.message
          : "Could not complete this action. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-50">
        <LoaderCircle className="size-6 animate-spin text-navy-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <img src="/logo.png" alt="MiDukandar" className="size-10 shrink-0 rounded-xl object-contain" />
          <div>
            <h1 className="font-display text-lg font-bold text-navy-900">
              {isRegistration ? "Create your account" : "Set up your store"}
            </h1>
            <p className="text-xs text-navy-400">
              {isRegistration
                ? "Register your account and store in one step."
                : "One step away from billing, inventory &amp; udhaari."}
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-navy-200 px-3 py-1 text-xs font-semibold text-navy-600">
            <StoreIcon className="size-3.5 text-royal-600" />
            {user?.email ?? "New registration"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <form
          className="space-y-5 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {isRegistration && (
            <>
              <Field label="Account Email">
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => {
                    set("email", e.target.value);
                  }}
                  placeholder="owner@yourstore.in"
                  className={inputClass}
                />
              </Field>
              <Field label="Shop Owner Name">
                <input
                  autoComplete="name"
                  value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className={inputClass}
                />
              </Field>
            </>
          )}

          <Field label="Shop / Business Name">
            <input
              value={form.name}
              autoFocus
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Shree Ganesh General Store"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Store Type">
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputClass}>
                {STORE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <MobileInput
                value={form.phone}
                onChange={(v) => set("phone", v)}
                placeholder="98765 43210"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="GSTIN" hint="Optional">
              <input
                value={form.gst}
                onChange={(e) => set("gst", e.target.value.toUpperCase().slice(0, 15))}
                placeholder="27ABCDE1234F1Z5"
                className={`${inputClass} font-mono tracking-wider`}
              />
            </Field>
            <Field label="Language">
              <select
                value={form.language}
                onChange={(e) => set("language", e.target.value)}
                className={inputClass}
              >
                {Object.entries(LANGUAGES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Shop no, street, area"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="City">
              <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Pune" className={inputClass} />
            </Field>
            <Field label="State">
              <select value={form.state} onChange={(e) => set("state", e.target.value)} className={inputClass}>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pincode">
              <input
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="411001"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Invoice Prefix" hint="e.g. INV → INV-0001">
            <input
              value={form.invoicePrefix}
              onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase().slice(0, 6))}
              className={`${inputClass} font-mono uppercase`}
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-navy-900 font-display text-sm font-bold text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <MapPin className="size-4" />}
            {isRegistration ? "Create Account" : "Create Store & Start Billing"}
            <ArrowRight className="size-4" />
          </button>

          <p className="text-center text-xs text-navy-400">
            {isRegistration ? "Already have an account?" : "Not you?"}{" "}
            <Link href="/login" className="font-semibold text-royal-600 hover:text-royal-700">
              Sign in
            </Link>
          </p>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-navy-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3 text-emerald-600" /> Secure &amp; private
          </span>
          <span>·</span>
          <span>GST-ready invoicing</span>
          <span>·</span>
          <span>Offline billing support</span>
        </div>
      </main>

      <footer className="border-t border-navy-100 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs sm:flex-row">
          <p className="text-navy-400">© {new Date().getFullYear()} MiDukandar</p>
          <div className="flex items-center gap-4 font-semibold text-royal-600">
            <Link href="/pricing" className="hover:text-royal-700">Pricing</Link>
            <Link href="/terms" className="hover:text-royal-700">Terms of Service</Link>
            <a href="mailto:support@midukandar.com" className="hover:text-royal-700">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
