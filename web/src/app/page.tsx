import type { Metadata } from "next";
import MiDukandarLanding from "@/components/landing/MiDukandarLanding";

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

export default function HomePage() {
  return <MiDukandarLanding />;
}