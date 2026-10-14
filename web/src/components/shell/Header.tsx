"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Cloud,
  Globe,
  LogOut,
  Menu,
  Settings,
  UserRound,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useI18n } from "@/components/i18n-provider";
import { LOCALES, LOCALE_SHORT } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { locale, setLocale } = useI18n();
  const { user, store, logout, setStore } = useAuth();

  const displayName = user?.name ?? user?.email ?? "Store Owner";
  const storeName = store?.name ?? "MiDukandar";

  useEffect(() => {
    if (store?.language) setLocale(store.language as "en" | "hi" | "mr");
  }, [setLocale, store?.language]);

  const handleLanguageChange = async (language: "en" | "hi" | "mr") => {
    setLocale(language);
    try {
      const data = await apiFetch<{ store: typeof store }>("/api/settings/language", {
        method: "PATCH",
        body: { language },
      });
      if (data.store) setStore(data.store);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save language");
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", body: {}, noAuth: true });
    } catch {
      // ignore
    }
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-navy-100 bg-white px-3 sm:px-4 lg:gap-3 lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy-100 bg-navy-50 text-navy-700 transition-colors hover:bg-navy-100 lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold text-navy-900">{storeName}</span>
          <span className="hidden truncate text-[11px] text-navy-400 sm:block">{user?.email}</span>
        </span>
      </div>

      <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 xl:inline-flex">
        <Cloud className="size-3.5" />
        Synced
      </span>

      <div className="hidden items-center rounded-lg bg-navy-50 p-0.5 sm:flex">
        {LOCALES.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => void handleLanguageChange(l.value)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
              locale === l.value
                ? "bg-white text-navy-900 shadow-sm"
                : "text-navy-500 hover:text-navy-700"
            }`}
          >
            {LOCALE_SHORT[l.value]}
          </button>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-navy-50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-royal-300">
              {(storeName ?? "?").slice(0, 1)}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-xs font-semibold text-navy-900">{displayName}</span>
              <span className="block truncate text-[10px] text-navy-400">{user?.role ?? "OWNER"}</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <p className="flex items-center gap-1.5 font-semibold text-navy-900">
              <UserRound className="size-3.5" />
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleLanguageChange(locale === "en" ? "hi" : locale === "hi" ? "mr" : "en")}>
            <Globe className="size-4" />
            Switch language
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="size-4" />
            Store Settings
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => void handleLogout()}>
            <LogOut className="size-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
