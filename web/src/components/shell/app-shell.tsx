"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, CreditCard, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { planHasModule, type PlanModuleKey } from "@/lib/plan-catalog";
import { useAuth } from "@/lib/auth-store";
import Sidebar from "@/components/shell/Sidebar";
import Header from "@/components/shell/Header";
import AdBanner from "@/components/AdBanner";

const MOBILE_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "DASHBOARD" as PlanModuleKey },
  { href: "/invoices", label: "Billing", icon: CreditCard, moduleKey: "SALES_INVOICES" as PlanModuleKey },
  { href: "/products", label: "Products", icon: Boxes, moduleKey: "PRODUCTS" as PlanModuleKey },
  { href: "/customers", label: "Customers", icon: Users, moduleKey: "CUSTOMERS_UDHAARI" as PlanModuleKey },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const store = useAuth((state) => state.store);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("md-shell-collapsed") === "1";
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMobileOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("md-shell-collapsed", next ? "1" : "0");
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[margin] duration-200",
          collapsed ? "lg:ml-16" : "lg:ml-60",
        )}
      >
        <Header onMenuClick={() => setMobileOpen((open) => !open)} />
        <AdBanner />
        <main className="flex-1 p-3 pb-20 sm:p-4 lg:p-6 lg:pb-6">{children}</main>
        <footer className="border-t border-navy-100 bg-white px-3 pb-20 pt-3 sm:px-4 sm:pb-3 lg:px-6">
          <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-navy-400 sm:flex-row">
            <p>© {new Date().getFullYear()} MiDukandar</p>
            <div className="flex items-center gap-4 font-semibold text-navy-600">
              <Link href="/pricing" className="transition-colors hover:text-royal-600">Pricing</Link>
              <Link href="/terms" className="transition-colors hover:text-royal-600">Terms of Service</Link>
            </div>
          </div>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white/95 shadow-[0_-10px_30px_rgba(15,39,71,0.08)] backdrop-blur-sm sm:hidden">
        <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
          {MOBILE_NAV.filter(({ moduleKey }) => !store?.planDetails || planHasModule(store.planDetails, moduleKey)).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-medium transition-colors",
                  active ? "bg-navy-900 text-white" : "text-navy-500 hover:bg-navy-50",
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}