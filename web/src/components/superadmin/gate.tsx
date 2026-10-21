"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSaAuth } from "@/lib/superadmin-store";
import { scheduleSaRefresh } from "@/lib/superadmin-api";

export default function SuperadminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, user, init } = useSaAuth();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (ready && user) {
      scheduleSaRefresh();
    }
  }, [ready, user]);

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}