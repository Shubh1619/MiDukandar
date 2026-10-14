"use client";

import { useState } from "react";
import { CreditCard, Layers3, LayoutDashboard, ScrollText, Settings, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/shell/Sidebar";
import SuperadminHeader from "@/components/superadmin/header";

const NAV = [
  { href: "/superadmin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/superadmin/tenants", label: "Tenants", icon: Store },
  { href: "/superadmin/billing", label: "Subscriptions & Billing", icon: CreditCard },
  { href: "/superadmin/plans", label: "Plans & Subscription", icon: Layers3 },
  { href: "/superadmin/settings", label: "Settings", icon: Settings },
  { href: "/superadmin/logs", label: "Audit Logs", icon: ScrollText },
];

export default function SuperadminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("md-shell-collapsed") === "1";
  });

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
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar collapsed={collapsed} onToggle={toggle} items={NAV} roleKey="SUPERADMIN" />

      <div className={cn("flex min-w-0 flex-1 flex-col", collapsed ? "ml-16" : "ml-60")}>
        <SuperadminHeader />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}