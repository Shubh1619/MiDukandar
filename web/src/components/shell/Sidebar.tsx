"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  HandCoins,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-store";
import type { PermissionFlag } from "@/lib/types";
import { planHasModule, type PlanModuleKey } from "@/lib/plan-catalog";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  CASHIER: "Cashier",
  MANAGER: "Manager",
  STOCK_MANAGER: "Stock Manager",
  SUPERADMIN: "Platform Admin",
};

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  permission?: string;
  moduleKey?: PlanModuleKey;
}

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "DASHBOARD" },
  { href: "/products", label: "Products & Stock", icon: Package, permission: "can_manage_products", moduleKey: "PRODUCTS" },
  { href: "/invoices", label: "Sales & Invoices", icon: ReceiptText, permission: "can_manage_invoices", moduleKey: "SALES_INVOICES" },
  { href: "/customers", label: "Customers", icon: Users, permission: "can_manage_customers", moduleKey: "CUSTOMERS_UDHAARI" },
  { href: "/udhaari", label: "Udhaari", icon: HandCoins, permission: "can_manage_udhaari", moduleKey: "CUSTOMERS_UDHAARI" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, permission: "can_manage_suppliers", moduleKey: "SUPPLIERS" },
  { href: "/expenses", label: "Expenses", icon: Wallet, permission: "can_manage_expenses", moduleKey: "EXPENSES" },
  { href: "/reports", label: "GST & Reports", icon: BarChart3, permission: "can_view_reports", moduleKey: "GST_REPORTS" },
];

const SYSTEM_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, permission: "can_manage_settings" },
  { href: "/users", label: "Users & Roles", icon: UserCog, permission: "can_manage_users", moduleKey: "USERS_ROLES" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  items?: NavItem[];
  roleKey?: string;
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, items, roleKey, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, store } = useAuth();
  const nav = items ?? [];
  const hasCustomNav = Array.isArray(items);
  const role = roleKey ?? user?.role ?? "OWNER";
  const roleLabel = ROLE_LABEL[role] ?? role;
  const canSee = (item: NavItem) => {
    const pageKey = item.href.replace(/^\//, "");
    const granted = user?.access?.grantedPages?.includes(pageKey) ?? false;
    if (item.moduleKey && !granted && store?.planDetails && !planHasModule(store.planDetails, item.moduleKey)) return false;
    if (user?.access?.disabledPages?.includes(pageKey)) return false;
    if (item.permission && user?.access?.disabledFeatures?.includes(item.permission as PermissionFlag)) return false;
    if (!item.permission || role === "OWNER" || role === "SUPERADMIN") return true;
    return user?.permissions?.[item.permission as keyof typeof user.permissions] === true;
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const NavRow = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={onClose}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0 lg:justify-center",
          active
            ? "bg-navy-800 text-white ring-1 ring-navy-700"
            : "text-navy-200 hover:bg-navy-800/60 hover:text-white",
        )}
      >
        <Icon className={cn("size-4.5 shrink-0", !active && "text-navy-400 group-hover:text-royal-400")} />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="rounded bg-royal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-royal-300">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const navCollapsed = collapsed && !mobileOpen;

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/40 transition-opacity duration-200 sm:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-navy-900 bg-navy-950 text-white transition-all duration-200",
          "w-[82vw] max-w-[17rem] -translate-x-full sm:hidden",
          mobileOpen && "translate-x-0",
          "md:flex md:w-16 md:translate-x-0",
          "lg:w-60",
          navCollapsed && "lg:w-16",
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-navy-200 bg-white py-5",
            navCollapsed ? "justify-center" : "gap-2.5 px-4",
            "md:justify-center md:px-0 lg:gap-2.5 lg:px-4",
          )}
        >
          {navCollapsed ? (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
              <img src="/logo.png" alt="MiDukandar" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex h-16 items-center rounded-lg bg-white px-2 py-1.5">
                <img src="/logo.png" alt="MiDukandar" className="h-full w-auto object-contain" />
              </div>
              <p className="truncate text-[10px] text-navy-300">मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन</p>
            </div>
          )}
          {!navCollapsed && !mobileOpen && (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="hidden rounded-md p-1.5 text-navy-500 transition-colors hover:bg-navy-100 hover:text-navy-900 lg:inline-flex"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
          {mobileOpen && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="rounded-md p-1.5 text-navy-500 transition-colors hover:bg-navy-100 hover:text-navy-900 sm:hidden"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {navCollapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="mx-auto my-3 hidden rounded-md p-1.5 text-navy-400 transition-colors hover:bg-navy-800 hover:text-white lg:inline-flex"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        )}

        <div
          className={cn(
            "mx-3 mt-2 flex items-center gap-2 rounded-lg border border-navy-800 bg-navy-900/70 px-3 py-2",
            navCollapsed && "justify-center px-0 md:mx-1 md:px-0 lg:justify-center",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md bg-royal-500/20 text-royal-300",
              "text-[10px] font-bold",
            )}
          >
            {role === "CASHIER" ? "C" : role === "OWNER" ? "O" : role === "SUPERADMIN" ? "S" : "M"}
          </span>
          {!navCollapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-bold text-white">Role: {roleLabel}</span>
              <span className="block truncate text-[9px] text-navy-300">
                {role === "SUPERADMIN"
                  ? "Platform Access / प्रशासक"
                  : role === "CASHIER"
                    ? "मर्यादित दृश्यता / Limited Visibility"
                    : "Full Access / संपूर्ण प्रवेश"}
              </span>
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {hasCustomNav
            ? nav.map((item) => <NavRow key={item.href} item={item} />)
            : (
                <>
                  {MAIN_NAV.filter(canSee).map((item) => (
                    <NavRow key={item.href} item={item} />
                  ))}

                  {!navCollapsed && (
                    <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-500">
                      System
                    </p>
                  )}
                  {navCollapsed && <div className="my-2 h-px bg-navy-800" />}

                  {SYSTEM_NAV.filter(canSee).map((item) => (
                    <NavRow key={item.href} item={item} />
                  ))}
                </>
              )}
        </nav>

        <div
          className={cn(
            "border-t border-navy-800/70 px-4 py-3",
            navCollapsed && "flex justify-center px-0",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2 text-xs",
              navCollapsed ? "justify-center" : "justify-between",
            )}
          >
            {!navCollapsed && (
              <span className="inline-flex items-center gap-1.5 text-navy-300">
                <Wifi className="size-3.5 text-emerald-400" />
                Sync: <span className="font-semibold text-emerald-400">Online</span>
              </span>
            )}
            {navCollapsed && <Wifi className="size-3.5 text-emerald-400" />}
          </div>
        </div>
      </aside>
    </>
  );
}
