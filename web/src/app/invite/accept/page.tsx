import type { Metadata } from "next";
import { Suspense } from "react";
import InviteAcceptClient from "@/components/invite/InviteAcceptClient";

export const metadata: Metadata = {
  title: "Accept invitation",
};

export const dynamic = "force-dynamic";

export default function InviteAcceptPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f7fb] px-4 py-8 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-royal-300/25 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-[26rem] w-[26rem] rounded-full bg-navy-300/25 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={null}>
          <InviteAcceptClient />
        </Suspense>
      </div>
    </div>
  );
}
