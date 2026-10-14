"use client";

import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { useAuth } from "@/lib/auth-store";

type AdBannerProps = {
  placement?: "top" | "inline";
};

export default function AdBanner({ placement = "top" }: AdBannerProps) {
  const plan = useAuth((state) => state.store?.planDetails);
  if (!plan?.adsEnabled || plan.status !== "ACTIVE") return null;
  const minimal = plan.adsTier === "MINIMAL";

  return (
    <aside
      data-ad-placement={placement}
      data-ads-tier={plan.adsTier}
      className={`border-b border-amber-200 px-4 py-2.5 sm:px-6 ${minimal ? "bg-amber-50" : "bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50"}`}
      aria-label="Sponsored content"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 text-xs">
        <p className="flex min-w-0 items-center gap-2 text-amber-900">
          <Megaphone className="size-3.5 shrink-0 text-amber-600" aria-hidden />
          <span className="truncate"><span className="font-bold">Sponsored message</span>{!minimal && <span className="hidden sm:inline"> · Discover tools to help your business grow.</span>}</span>
        </p>
        <Link href="/pricing" className="inline-flex shrink-0 items-center gap-1 font-bold text-amber-800 hover:text-amber-950">
          Explore plans <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
