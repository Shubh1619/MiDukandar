import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

type PublicHeaderProps = {
  variant?: "simple" | "marketing";
};

export default function PublicHeader({ variant = "marketing" }: PublicHeaderProps) {
  if (variant === "simple") {
    return (
      <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/login" className="flex items-center gap-3" aria-label="MiDukandar home">
            <span className="flex h-11 items-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-navy-100">
              <Image src="/logo.png" alt="MiDukandar - Smart Business" width={160} height={56} className="h-7 w-auto object-contain" />
            </span>
            <span className="hidden sm:block">
              <span className="block font-display text-sm font-bold text-navy-950">MiDukandar</span>
              <span className="block text-[10px] text-navy-400">Smart Business</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-navy-700 transition-colors hover:text-royal-600"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            Back to Home
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-10">
        <Link href="/login" className="flex min-w-0 items-center gap-3" aria-label="MiDukandar home">
          <span className="flex h-11 shrink-0 items-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-navy-100">
            <Image src="/logo.png" alt="MiDukandar - Smart Business" width={160} height={56} className="h-7 w-auto object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block font-display text-sm font-bold text-navy-950">MiDukandar</span>
            <span className="block truncate text-[10px] text-navy-400">मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-navy-600 md:flex" aria-label="Main navigation">
          <Link href="/pricing" className="transition-colors hover:text-royal-600">
            Pricing
          </Link>
          <Link href="/terms" className="transition-colors hover:text-royal-600">
            Terms of Service
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-50 hover:text-navy-950 sm:inline-flex"
          >
            Sign In
          </Link>
          <Link
            href="/onboard"
            className="group inline-flex items-center gap-2 rounded-xl bg-navy-950 px-3.5 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgb(9_26_51/0.7)] transition-all hover:bg-navy-800 sm:px-4 sm:text-sm"
          >
            <Sparkles className="size-4 text-teal-300" aria-hidden />
            <span>Start Free Trial</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
