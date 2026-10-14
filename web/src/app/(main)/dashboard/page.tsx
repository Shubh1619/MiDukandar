"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeIndianRupee,
  Banknote,
  BarChart3,
  FileText,
  HandCoins,
  PackagePlus,
  PackageX,
  ReceiptText,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatINR } from "@/lib/format";
import { useDashQuery } from "@/lib/use-dash-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/stat-card";
import type { RecentTransaction, DashboardStats } from "@/lib/types";

interface DashboardResponse {
  stats: DashboardStats;
  from: string;
  to: string;
}

function DigitalClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours = now.getHours();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const hh = String(h12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ampm = hours < 12 ? "AM" : "PM";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 rounded-xl border border-red-900/40 bg-black px-4 py-2.5 shadow-[0_0_20px_-4px_rgba(239,68,68,0.45)]">
        <div className="font-mono text-2xl font-bold tabular-nums leading-none tracking-[0.2em] text-red-500 [text-shadow:0_0_10px_rgba(239,68,68,0.95),0_0_24px_rgba(239,68,68,0.55)]">
          {hh}
          <span className="clock-colon">:</span>
          {mm}
          <span className="clock-colon">:</span>
          {ss}
        </div>
        <span className="font-mono text-[10px] font-bold tracking-widest text-red-500 [text-shadow:0_0_8px_rgba(239,68,68,0.85)]">
          {ampm}
        </span>
      </div>
      <p className="pr-1 text-[11px] text-muted-foreground">
        {now.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" })}
      </p>
    </div>
  );
}

function QuickControls() {
  const actions = [
    { label: "Products", icon: PackagePlus, href: "/products" },
    { label: "Invoices", icon: FileText, href: "/invoices" },
    { label: "Udhaari", icon: HandCoins, href: "/customers" },
    { label: "Reports", icon: BarChart3, href: "/reports" },
  ];
  return (
    <Card className="border-navy-900 bg-navy-950 text-white">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm text-white">Quick Controls</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="group flex items-center gap-3 rounded-xl border border-navy-800 bg-navy-900/70 p-3 transition-colors hover:border-royal-500/40"
            >
              <Icon className="size-4 shrink-0 text-royal-400" />
              <p className="truncate text-xs font-semibold text-white group-hover:text-royal-300">
                {a.label}
              </p>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

const TX_META: Record<string, { label: string; chip: string }> = {
  SALE: {
    label: "Sale",
    chip: "bg-emerald-100 text-emerald-700",
  },
  PURCHASE: {
    label: "Purchase",
    chip: "bg-navy-100 text-navy-600",
  },
  PAYMENT: {
    label: "Payment",
    chip: "bg-royal-100 text-royal-700",
  },
};

export default function DashboardPage() {
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    const res = await apiFetch<DashboardResponse>("/api/reports/dashboard");
    return res;
  }, []);

  const query = useDashQuery<DashboardResponse>(fetcher, { pollMs: 30000 });

  const stats = query.data?.stats ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Today&apos;s performance across your store
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DigitalClock />
          {query.error && (
            <button
              type="button"
              onClick={() => query.refresh()}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Load failed - Retry
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={Banknote}
              label="Sales Today"
              value={formatINR(stats.todaySales)}
              sub="Confirmed bills today"
            />
            <StatCard
              icon={ShoppingCart}
              label="Purchases Today"
              value={formatINR(stats.todayPurchases)}
              sub="Stock purchases today"
            />
            <StatCard
              icon={BadgeIndianRupee}
              label="Est. Profit Today"
              value={formatINR(stats.todayProfit)}
              sub="Margin before tax today"
              tone="text-emerald-600"
            />
            <StatCard
              icon={Wallet}
              label="Customer Udhaari"
              value={formatINR(stats.receivables)}
              sub="Total outstanding ledger"
            />
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!stats ? (
          <Skeleton className="h-[112px] rounded-xl" />
        ) : (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Wallet className="size-4 text-navy-600" />
                Supplier Payables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-lg font-bold tabular-nums">{formatINR(stats.payables)}</p>
              <p className="text-[11px] text-muted-foreground">Due on open purchase invoices</p>
            </CardContent>
          </Card>
        )}

        {!stats ? (
          <Skeleton className="h-[112px] rounded-xl" />
        ) : (
          <Link href="/inventory?low=1">
            <Card className="transition-colors hover:border-red-200">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <PackageX className="size-4 text-red-600" />
                  Low Stock
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-7">
                <p className="font-display text-3xl font-bold tabular-nums text-red-600">
                  {stats.lowStockCount}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Products below min stock level
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        <QuickControls />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <ReceiptText className="size-4 text-navy-700" />
            Recent Transactions
          </CardTitle>
          <Link href="/invoices" className="text-[11px] font-semibold text-navy-700 hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <Skeleton className="h-[280px] rounded-xl" />
          ) : stats.recentTransactions.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              No transactions yet. Create your first sale from the Invoices page.
            </p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-navy-100 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Type</th>
                      <th className="py-2 pr-3 font-semibold">No.</th>
                      <th className="py-2 pr-3 font-semibold">Party</th>
                      <th className="py-2 pr-3 font-semibold">Mode</th>
                      <th className="py-2 pr-3 text-right font-semibold">Amount</th>
                      <th className="py-2 text-right font-semibold">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentTransactions.map((tx) => {
                      const meta = TX_META[tx.type] ?? TX_META.SALE;
                      return (
                        <tr key={`${tx.type}-${tx.id}`} className="border-b border-navy-50 last:border-0">
                          <td className="py-2.5 pr-3">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", meta.chip)}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 font-semibold tabular-nums">{tx.number}</td>
                          <td className="max-w-[180px] truncate py-2.5 pr-3 text-navy-700">{tx.party}</td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{tx.mode ?? "-"}</td>
                          <td className="py-2.5 pr-3 text-right font-bold tabular-nums">
                            {formatINR(tx.amount)}
                          </td>
                          <td className="py-2.5 text-right text-[11px] text-muted-foreground">
                            {formatDateTime(tx.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 md:hidden">
                {stats.recentTransactions.map((tx) => {
                  const meta = TX_META[tx.type] ?? TX_META.SALE;
                  return (
                    <div key={`${tx.type}-${tx.id}`} className="rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy-900">{tx.party}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{tx.number}</p>
                        </div>
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", meta.chip)}>
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{tx.mode ?? "-"}</span>
                        <span className="font-bold tabular-nums text-navy-900">{formatINR(tx.amount)}</span>
                      </div>

                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {formatDateTime(tx.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!stats && query.error && (
            <p className="py-6 text-center text-xs text-red-600">
              Could not load dashboard: {query.error}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Truck className="size-3" />
        Purchases &amp; payables come from open purchase invoices.
      </p>
    </div>
  );
}