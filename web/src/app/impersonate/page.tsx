"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setImpersonation } from "@/lib/impersonation";

/**
 * Cross-origin handoff endpoint. The SuperAdmin console (different origin /
 * port) delivers the impersonation token through the URL fragment — fragments
 * are never sent to servers, so the token is only visible to this tab. Once
 * stored locally, the app reloads and boots the impersonated session.
 */
export default function ImpersonatePage() {
  const router = useRouter();

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const payload = JSON.parse(decodeURIComponent(raw)) as {
        accessToken?: string;
        tenantName?: string;
        expiresAt?: number;
        by?: string;
      };
      if (payload.accessToken && typeof payload.expiresAt === "number" && payload.expiresAt > Date.now()) {
        setImpersonation({
          accessToken: payload.accessToken,
          tenantName: payload.tenantName ?? "Tenant",
          expiresAt: payload.expiresAt,
          by: payload.by ?? "Platform admin",
        });
        window.location.replace("/");
        return;
      }
    } catch {
      // fall through to login
    }
    router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
      Setting up impersonation…
    </div>
  );
}