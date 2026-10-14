import type { Metadata } from "next";
import PublicFooter from "@/components/public/PublicFooter";
import PublicHeader from "@/components/public/PublicHeader";
import PricingInteractive from "@/components/public/PricingInteractive";
import type { PlanDefinition } from "@/lib/plan-catalog";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent MiDukandar plans for shops and growing businesses.",
};

export const dynamic = "force-dynamic";

async function loadPlans(): Promise<PlanDefinition[]> {
  const baseUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${baseUrl}/api/plans`, { cache: "no-store" });
    if (!response.ok) return [];
    const data = (await response.json()) as { plans?: PlanDefinition[] };
    return Array.isArray(data.plans) ? data.plans : [];
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const plans = await loadPlans();
  return (
    <div className="min-h-screen bg-[#f7f9fc] text-navy-900">
      <PublicHeader />
      <PricingInteractive initialPlans={plans} />
      <PublicFooter />
    </div>
  );
}
