"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  ChevronDown,
  Headphones,
  Landmark,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Minus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  PLAN_COMPARISON_ROWS,
  formatPlanPrice,
  getPlanModule,
  planFeatureList,
  type PlanDefinition,
} from "@/lib/plan-catalog";

type BillingCycle = "monthly" | "yearly";
type PlanValue = boolean | string;
type ComparisonRow = (typeof PLAN_COMPARISON_ROWS)[number];

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer: "Yes. You can cancel a future renewal before the next billing date. Access to paid features continues until the end of the paid period, subject to the applicable terms.",
  },
  {
    question: "What happens to my data if I downgrade?",
    answer: "Your business data is not deleted just because you move to a lower plan. Features and limits outside the selected plan may become unavailable, so export anything you need before downgrading.",
  },
  {
    question: "Do you offer refunds?",
    answer: "Refund eligibility depends on the plan, purchase timing and the reason for the request. Published subscription charges are generally non-refundable except where required by law or approved by support.",
  },
  {
    question: "Is there a setup fee?",
    answer: "No setup fee is advertised for the Free or Pro plans. Enterprise onboarding is tailored to the rollout, so any one-time implementation charge is confirmed in writing before work begins.",
  },
  {
    question: "What payment methods do you accept for subscription billing?",
    answer: "Subscription payment methods are confirmed at checkout. MiDukandar uses Razorpay for payment processing where enabled; the gateway's terms apply to the transaction.",
  },
];

function planIsFree(plan: PlanDefinition) {
  return plan.isDefault || plan.name.trim().toLowerCase() === "free";
}

function planPrice(plan: PlanDefinition, billing: BillingCycle) {
  const value = billing === "monthly" ? plan.priceMonthly : plan.priceYearly;
  if (planIsFree(plan)) return { value: "₹0", suffix: "forever" };
  if (value <= 0) return { value: "Contact Us", suffix: "tailored pricing" };
  return { value: formatPlanPrice(value), suffix: billing === "monthly" ? "/ month" : "/ year" };
}

function savingPercent(plan: PlanDefinition) {
  if (plan.priceMonthly <= 0 || plan.priceYearly <= 0) return 0;
  return Math.max(0, Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100));
}

function planCta(plan: PlanDefinition) {
  if (planIsFree(plan)) return { label: "Start Free Trial", href: "/onboard", external: false };
  const message = encodeURIComponent(`Hello MiDukandar, I would like to know more about the ${plan.name} plan.`);
  return { label: "Talk to Sales", href: `https://wa.me/918000629385?text=${message}`, external: true };
}

function moduleValue(plan: PlanDefinition, row: ComparisonRow): PlanValue {
  if (row.ads) return !plan.adsEnabled;
  if (!row.moduleKey) return false;
  const planModule = getPlanModule(plan, row.moduleKey);
  if (!planModule?.enabled) return false;
  if (planModule.moduleKey === "PRODUCTS") return planModule.limitValue === 0 ? "Unlimited products" : planModule.limitValue == null ? true : `Up to ${planModule.limitValue}`;
  if (planModule.moduleKey === "USERS_ROLES") return planModule.limitValue === 0 ? "Unlimited staff" : planModule.limitValue == null ? true : `Up to ${planModule.limitValue} staff`;
  if (planModule.moduleKey === "MULTI_STORE") return planModule.limitValue === 0 ? "Unlimited stores" : planModule.limitValue == null ? true : `Up to ${planModule.limitValue} stores`;
  return true;
}

function ValueCell({ value }: { value: PlanValue }) {
  if (value === true) return <Check className="mx-auto size-4 text-emerald-600" strokeWidth={2.5} aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto size-4 text-navy-300" aria-label="Not included" />;
  return <span className="text-[11px] font-semibold text-navy-700">{value}</span>;
}

function PlanCard({ plan, billing, icon }: { plan: PlanDefinition; billing: BillingCycle; icon: typeof Sparkles }) {
  const price = planPrice(plan, billing);
  const cta = planCta(plan);
  const Icon = icon;
  return (
    <article className={`relative flex flex-col rounded-3xl border p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-lift sm:p-7 ${plan.isPopular ? "border-royal-500/40 bg-white ring-2 ring-royal-500/15" : "border-navy-100 bg-white/90"}`}>
      {plan.isPopular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-royal-600 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_18px_-8px_rgb(20_115_230/0.8)]">Most popular</div>}
      <div className="flex items-start justify-between gap-3"><div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${plan.isPopular ? "bg-royal-50 text-royal-700" : "bg-navy-50 text-navy-600"}`}><Icon className="size-3" aria-hidden />{plan.adsEnabled ? "Starter" : plan.isPopular ? "Recommended" : "Advanced"}</span><h2 className="mt-4 font-display text-2xl font-bold text-navy-950">{plan.name}</h2><p className="mt-1 text-xs font-semibold text-navy-500">{plan.supportTier || "Standard support"}</p></div>{plan.isPopular && <span className="flex size-10 items-center justify-center rounded-xl bg-royal-600 text-white"><TrendingUp className="size-5" aria-hidden /></span>}</div>
      <div className="mt-7 min-h-[76px] border-b border-navy-100 pb-5"><p className="font-display text-3xl font-bold tracking-tight text-navy-950">{price.value}</p><p className="mt-1 text-xs font-medium text-navy-500">{price.suffix}{plan.trialDays > 0 && planIsFree(plan) ? " · trial included" : ""}</p></div>
      <p className="mt-5 min-h-12 text-sm leading-relaxed text-navy-500">{plan.description || "A flexible plan for your business."}</p>
      {cta.external ? <a href={cta.href} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-navy-200 bg-white px-4 text-sm font-bold text-navy-800 transition-colors hover:border-royal-400 hover:text-royal-700">{cta.label}<MessageCircle className="size-4 text-emerald-600" aria-hidden /></a> : <Link href={cta.href} className={`group mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-all ${plan.isPopular ? "bg-royal-600 text-white shadow-[0_10px_24px_-10px_rgb(20_115_230/0.7)] hover:bg-royal-700" : "bg-navy-950 text-white hover:bg-navy-800"}`}>{cta.label}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>}
      <div className="mt-7 border-t border-navy-100 pt-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-navy-500">What&apos;s included</p><ul className="mt-4 space-y-3">{planFeatureList(plan).map((feature) => <li key={feature} className="flex items-start gap-2.5 text-sm text-navy-600"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />{feature}</li>)}</ul></div>
    </article>
  );
}

function ComparisonTable({ plans }: { plans: PlanDefinition[] }) {
  return <div className="hidden overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-card md:block"><div className="flex items-center justify-between border-b border-navy-100 px-6 py-5"><div><p className="font-display text-lg font-bold text-navy-950">Compare every plan</p><p className="mt-1 text-xs text-navy-500">A clearer view of what changes as your business grows.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Live catalog</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr className="border-b border-navy-100 bg-navy-50/60"><th className="w-[32%] px-6 py-4 text-xs font-bold uppercase tracking-[0.1em] text-navy-500">Feature</th>{plans.map((plan) => <th key={plan.id} className={`px-4 py-4 text-center text-sm font-bold ${plan.isPopular ? "bg-royal-50/60 text-royal-800" : "text-navy-800"}`}>{plan.name}</th>)}</tr></thead><tbody>{PLAN_COMPARISON_ROWS.map((row) => <tr key={row.label} className="border-b border-navy-50 last:border-0"><th scope="row" className="px-6 py-4 text-sm font-medium text-navy-700">{row.label}</th>{plans.map((plan) => <td key={`${row.label}-${plan.id}`} className={`px-4 py-4 text-center ${plan.isPopular ? "bg-royal-50/40" : ""}`}><ValueCell value={moduleValue(plan, row)} /></td>)}</tr>)}</tbody></table></div></div>;
}

function MobileComparison({ plans }: { plans: PlanDefinition[] }) {
  const [selectedId, setSelectedId] = useState(plans[0]?.id ?? "");
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  if (!selected) return null;
  return <div className="overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-card md:hidden"><div className="border-b border-navy-100 px-5 py-5"><div className="flex items-center justify-between gap-3"><div><p className="font-display text-lg font-bold text-navy-950">Compare every plan</p><p className="mt-1 text-xs text-navy-500">Choose a plan to see its breakdown.</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700">Live</span></div><div className="mt-5 grid grid-cols-3 gap-1.5 rounded-xl bg-navy-50 p-1.5">{plans.map((plan) => <button key={plan.id} type="button" aria-pressed={selected.id === plan.id} onClick={() => setSelectedId(plan.id)} className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${selected.id === plan.id ? "bg-white text-royal-700 shadow-sm" : "text-navy-500 hover:text-navy-800"}`}>{plan.name}</button>)}</div></div><div className="divide-y divide-navy-50">{PLAN_COMPARISON_ROWS.map((row) => <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3.5"><span className="text-sm font-medium text-navy-700">{row.label}</span><ValueCell value={moduleValue(selected, row)} /></div>)}</div></div>;
}

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return <section id="faq" className="scroll-mt-28"><div className="max-w-2xl"><span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-600"><BadgeCheck className="size-3.5 text-royal-600" aria-hidden />Questions, answered</span><h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-navy-950">Frequently asked questions</h2><p className="mt-2 text-sm leading-relaxed text-navy-500">The essentials before you choose a plan. Full legal details live in our Terms of Service.</p></div><div className="mt-8 divide-y divide-navy-100 overflow-hidden rounded-3xl border border-navy-100 bg-white shadow-card">{faqs.map((faq, index) => { const open = openIndex === index; return <div key={faq.question}><button type="button" aria-expanded={open} aria-controls={`faq-answer-${index}`} onClick={() => setOpenIndex(open ? null : index)} className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left transition-colors hover:bg-navy-50/60 sm:px-7"><span className="font-display text-sm font-bold text-navy-900 sm:text-base">{faq.question}</span><span className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${open ? "bg-royal-600 text-white" : "bg-navy-50 text-navy-500"}`}><ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden /></span></button>{open && <div id={`faq-answer-${index}`} className="px-5 pb-5 text-sm leading-7 text-navy-600 sm:px-7 sm:pb-6">{faq.answer}</div>}</div>; })}</div></section>;
}

export default function PricingInteractive({ initialPlans }: { initialPlans: PlanDefinition[] }) {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const plans = initialPlans;
  const icons = [Sparkles, TrendingUp, Layers3];
  const maxSaving = Math.max(...plans.map(savingPercent), 0);
  const isLive = plans.length > 0;

  return <>
    <section className="relative overflow-hidden bg-navy-950 text-white"><div aria-hidden className="pointer-events-none absolute inset-0"><div className="absolute -right-32 -top-40 size-[30rem] rounded-full bg-royal-500/20 blur-3xl" /><div className="absolute -bottom-48 left-1/4 size-[32rem] rounded-full bg-teal-500/10 blur-3xl" /><div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)", backgroundSize: "54px 54px" }} /></div><div className="relative mx-auto max-w-7xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pb-20 sm:pt-20 lg:px-10"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-royal-200"><Sparkles className="size-3.5 text-teal-300" aria-hidden />Pricing that grows with you</span><h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Simple, transparent pricing for every dukan</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-navy-200 sm:text-lg">Start free, bring your shop into one calm workspace, and choose more power when you are ready. हर दुकान के लिए साफ़ और सरल।</p><div className="mx-auto mt-9 inline-flex rounded-2xl border border-white/10 bg-white/5 p-1.5" role="group" aria-label="Billing cycle"><button type="button" aria-pressed={billing === "monthly"} onClick={() => setBilling("monthly")} className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${billing === "monthly" ? "bg-white text-navy-950" : "text-navy-200 hover:text-white"}`}>Monthly</button><button type="button" aria-pressed={billing === "yearly"} onClick={() => setBilling("yearly")} className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${billing === "yearly" ? "bg-white text-navy-950" : "text-navy-200 hover:text-white"}`}>Yearly<span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${billing === "yearly" ? "bg-teal-100 text-teal-800" : "bg-teal-400/15 text-teal-200"}`}>{maxSaving > 0 ? `Save ${maxSaving}%` : "Yearly"}</span></button></div><p className="mt-3 text-xs text-navy-400">{isLive ? "Live plan catalog · Prices and features managed by MiDukandar." : "Pricing catalog is temporarily unavailable."}</p></div></section>
    <main className="bg-[#f7f9fc]"><section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-royal-700">Choose your starting point</p><h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">One workspace, a plan for every stage</h2></div><p className="max-w-sm text-xs leading-5 text-navy-500 sm:text-right">All plans include secure access to your store. Paid features and limits follow the active plan definition.</p></div>{plans.length > 0 ? <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">{plans.map((plan, index) => <PlanCard key={plan.id} plan={plan} billing={billing} icon={icons[index % icons.length]} />)}</div> : <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800">Plan pricing is temporarily unavailable. Please try again shortly.</div>}</section>
      <section className="border-y border-navy-100 bg-white/70"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10"><div className="mb-8 max-w-2xl"><span className="inline-flex items-center gap-1.5 rounded-full bg-royal-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-royal-700"><Boxes className="size-3.5" aria-hidden />Side by side</span><h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-navy-950">Know exactly what&apos;s included</h2><p className="mt-2 text-sm leading-relaxed text-navy-500">A detailed breakdown derived from each plan&apos;s module access map.</p></div><ComparisonTable plans={plans} /><div className="mt-5"><MobileComparison plans={plans} /></div></div></section>
      <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20"><Faq /></section>
      <section className="border-t border-navy-100 bg-white"><div className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:grid-cols-3 sm:px-8 lg:px-10"><div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-navy-50/60 px-4 py-4"><span className="flex size-10 items-center justify-center rounded-xl bg-white text-royal-600 shadow-sm"><Landmark className="size-5" aria-hidden /></span><span><span className="block text-sm font-bold text-navy-900">RBI compliant</span><span className="block text-xs text-navy-500">Payment processing</span></span></div><div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-navy-50/60 px-4 py-4"><span className="flex size-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm"><BadgeCheck className="size-5" aria-hidden /></span><span><span className="block text-sm font-bold text-navy-900">GST Suvidha Provider</span><span className="block text-xs text-navy-500">GST-ready tooling</span></span></div><div className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-navy-50/60 px-4 py-4"><span className="flex size-10 items-center justify-center rounded-xl bg-white text-royal-600 shadow-sm"><LockKeyhole className="size-5" aria-hidden /></span><span><span className="block text-sm font-bold text-navy-900">256-bit security</span><span className="block text-xs text-navy-500">Secure data handling</span></span></div></div></section>
      <section className="bg-[#f7f9fc] px-5 py-14 sm:px-8 sm:py-20 lg:px-10"><div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-navy-950 px-6 py-12 text-center text-white shadow-lift sm:px-10 sm:py-16"><div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-royal-500/25 blur-3xl" /><div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-teal-400/10 blur-3xl" /><div className="relative"><span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-royal-200"><Headphones className="size-3.5" aria-hidden />Here when you need us</span><h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">Still have questions? Talk to us.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-navy-200">Tell us how you run your business and we&apos;ll help you choose the right starting point.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><a href="https://wa.me/918000629385" target="_blank" rel="noreferrer" className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 text-sm font-bold text-navy-950 transition-colors hover:bg-teal-300"><MessageCircle className="size-4" aria-hidden />Chat on WhatsApp<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></a><Link href="/terms" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10">Read Terms of Service<ArrowRight className="size-4" aria-hidden /></Link></div></div></div></section>
    </main>
  </>;
}
