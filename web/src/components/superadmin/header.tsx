"use client";

import { useRouter } from "next/navigation";
import { Cloud, LogOut } from "lucide-react";
import { useSaAuth } from "@/lib/superadmin-store";

export default function SuperadminHeader() {
  const router = useRouter();
  const { user, logout } = useSaAuth();

  const displayName = user?.name ?? user?.email ?? "Platform Admin";

  const handleLogout = () => {
    // Fire-and-forget: the store clears client state (and expires the httpOnly
    // cookie server-side) even if the request fails.
    void logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-navy-100 bg-white px-4 lg:gap-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src="/logo.png" alt="MiDukandar" className="size-8 shrink-0 rounded-lg object-contain" />
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold text-navy-900">
            MiDukandar Platform
          </span>
          <span className="block truncate text-[11px] text-navy-400">{user?.email}</span>
        </span>
      </div>

      <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 xl:inline-flex">
        <Cloud className="size-3.5" />
        Synced
      </span>

      <div className="min-w-4 flex-1" />

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-royal-300">
          {displayName.slice(0, 1)}
        </span>
        <span className="hidden min-w-0 text-right sm:block">
          <span className="block truncate text-xs font-semibold text-navy-900">{displayName}</span>
          <span className="block truncate text-[10px] text-navy-400">Platform Admin</span>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </header>
  );
}