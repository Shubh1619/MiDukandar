import Image from "next/image";
import Link from "next/link";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";

type PublicFooterProps = {
  compact?: boolean;
  dark?: boolean;
};

export default function PublicFooter({ compact = false, dark = false }: PublicFooterProps) {
  const surface = dark
    ? "border-navy-800 bg-navy-950 text-white"
    : "border-navy-100 bg-white text-navy-600";
  const muted = dark ? "text-navy-400" : "text-navy-400";
  const link = dark ? "text-navy-200 hover:text-white" : "text-navy-600 hover:text-royal-600";

  return (
    <footer className={`border-t ${surface}`}>
      <div className={`mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10 ${compact ? "lg:py-5" : "lg:py-7"}`}>
        <div>
          <Link href="/login" className={`inline-flex items-center gap-2 font-display text-sm font-bold ${dark ? "text-white" : "text-navy-950"}`}>
            <span className="flex h-8 items-center rounded-lg bg-white px-1.5 py-1">
              <Image src="/logo.png" alt="MiDukandar" width={160} height={56} className="h-5 w-auto object-contain" />
            </span>
            MiDukandar
          </Link>
          <p className={`mt-2 text-xs ${muted}`}>मी दुकानदार - स्मार्ट व्यवसाय व्यवस्थापन</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold">
          <Link href="/pricing" className={link}>
            Pricing
          </Link>
          <Link href="/terms" className={link}>
            Terms of Service
          </Link>
          <a href="mailto:support@midukandar.com" className={`inline-flex items-center gap-1.5 ${link}`}>
            <Mail className="size-3.5" aria-hidden />
            Support
          </a>
          {!compact && (
            <a href="https://wa.me/918000629385" target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 ${link}`}>
              <MessageCircle className="size-3.5" aria-hidden />
              WhatsApp
            </a>
          )}
        </div>
      </div>
      {!compact && (
        <div className={`border-t px-5 py-3 text-center text-[10px ${muted} sm:px-8 lg:px-10`}>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" aria-hidden />
            © {new Date().getFullYear()} MiDukandar. Built for Shops & Businesses.
          </span>
        </div>
      )}
    </footer>
  );
}
