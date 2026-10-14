"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Timer, X } from "lucide-react";
import { clearImpersonation, getImpersonation, type ImpersonationSession } from "@/lib/impersonation";

export default function ImpersonationBanner() {
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      setSession(getImpersonation());
      setNow(Date.now());
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => clearInterval(iv);
  }, []);

  if (!session) return null;

  const remainingMs = session.expiresAt - now;
  const expired = remainingMs <= 0;
  const minutes = Math.max(0, Math.ceil(remainingMs / 60_000));

  const exit = () => {
    clearImpersonation();
    window.location.replace("/");
  };

  return (
    <div
      className={`sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-2 text-sm text-white ${expired ? "bg-red-600" : "bg-amber-500"}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {expired ? <Timer className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
        {expired ? (
          <span>This impersonation session has expired.</span>
        ) : (
          <span className="truncate">
            <strong>Impersonating</strong> {session.tenantName} — {minutes} min remaining
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={exit}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
      >
        <X className="h-3.5 w-3.5" />
        Exit impersonation
      </button>
    </div>
  );
}