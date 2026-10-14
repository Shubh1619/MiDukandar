"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-store";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, user, store, init } = useAuth();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!store) {
      router.replace("/onboard");
    }
  }, [ready, user, store, router]);

  if (!ready || !user || !store) {
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