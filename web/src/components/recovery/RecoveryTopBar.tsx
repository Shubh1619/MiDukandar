"use client";

import { LockKeyhole, Phone, ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LOCALES, LOCALE_SHORT } from "@/lib/i18n";

export default function RecoveryTopBar() {
  const { locale, setLocale } = useI18n();

  return (
    <header className="sticky top-0 z-20 border-b border-navy-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="MiDukandar" className="h-9 w-auto object-contain" />
          <span className="mx-2 hidden h-5 w-px bg-navy-100 sm:block" />
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-navy-50 px-2.5 py-1 text-[10px] font-semibold text-navy-600">
              <ShieldCheck className="size-3 text-green-700" /> Secure sessions
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-navy-50 px-2.5 py-1 text-[10px] font-semibold text-navy-600">
              <LockKeyhole className="size-3 text-royal-600" /> HTTPS encrypted
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          <a
            href="tel:18006393852"
            className="hidden items-center gap-1.5 text-xs font-semibold text-navy-700 hover:text-royal-600 md:flex"
          >
            <Phone className="size-3.5 text-royal-600" />
            <span className="font-mono tracking-wide">1800-MI-DUKAN</span>
            <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
              24/7
            </span>
          </a>
          <div className="flex items-center rounded-lg bg-navy-50 p-0.5">
            {LOCALES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLocale(l.value)}
                aria-pressed={locale === l.value}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  locale === l.value
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-navy-400 hover:text-navy-700"
                }`}
              >
                {LOCALE_SHORT[l.value]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}