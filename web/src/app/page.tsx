import type { Metadata } from "next";
import MiDukandarLanding from "@/components/landing/MiDukandarLanding";
import type { PlanDefinition } from "@/lib/plan-catalog";

export const metadata: Metadata = {
  title: "MiDukandar — Retail Billing, Inventory and Business Management",
  description:
    "Manage retail billing, inventory, purchases, customer credit, suppliers, and business reports with MiDukandar.",
  openGraph: {
    title: "MiDukandar — Retail Billing, Inventory and Business Management",
    description:
      "Manage retail billing, inventory, purchases, customer credit, suppliers, and business reports with MiDukandar.",
    type: "website",
  },
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

export default async function HomePage() {
  const plans = await loadPlans();
  return <MiDukandarLanding initialPlans={plans} />;
}