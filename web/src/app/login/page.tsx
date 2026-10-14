import type { Metadata } from "next";
import LeftPanel from "@/components/login/LeftPanel";
import LoginClient from "@/components/login/LoginClient";

export const metadata: Metadata = {
  title: "Login",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f7fb] px-4 py-8 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-royal-300/25 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-[26rem] w-[26rem] rounded-full bg-navy-300/25 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div className="login-rise relative z-10 w-full max-w-[1150px]">
        <div className="grid overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_16px_48px_-12px_rgb(15_39_71/0.14)] lg:min-h-[600px] lg:grid-cols-[46fr_54fr]">
          <div className="hidden lg:block">
            <LeftPanel />
          </div>
          <LoginClient />
        </div>
      </div>
    </div>
  );
}