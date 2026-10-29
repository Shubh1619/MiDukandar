import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";

export default function LandingFooter() {
  return (
    <footer id="contact" className="border-t border-navy-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-12 lg:px-10 lg:py-16">
        <div className="lg:col-span-5">
          <Link href="/" className="inline-flex items-center gap-2 font-display text-base font-bold text-navy-950">
            <span className="flex h-10 items-center rounded-lg bg-white px-1.5 py-1 shadow-sm ring-1 ring-navy-100">
              <Image src="/logo.png" alt="MiDukandar" width={160} height={56} className="h-6 w-auto object-contain" />
            </span>
            MiDukandar
          </Link>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-600">
            MiDukandar helps retailers manage billing, inventory, purchases, customer credit, suppliers, and business reports
            from one easy-to-use platform.
          </p>
          <p className="mt-3 text-xs text-navy-400">MiDukandar - Smart Business</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-3">
          <div>
            <h3 className="text-sm font-bold text-navy-950">Product</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-navy-600">
              <li>
                <a href="#features" className="transition-colors hover:text-royal-600">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="transition-colors hover:text-royal-600">
                  How It Works
                </a>
              </li>
              <li>
                <Link href="/pricing" className="transition-colors hover:text-royal-600">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-navy-950">Account</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-navy-600">
              <li>
                <Link href="/login" className="transition-colors hover:text-royal-600">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition-colors hover:text-royal-600">
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-navy-950">Support</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-navy-600">
              <li>
                <a href="mailto:trinetraservices.ltd@gmail.com" className="inline-flex items-center gap-2 transition-colors hover:text-royal-600">
                  <Mail className="size-4" aria-hidden />
                  trinetraservices.ltd@gmail.com
                </a>
              </li>
              <li className="text-navy-500">+91 99703 68016</li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-royal-600">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-royal-600">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/refund" className="transition-colors hover:text-royal-600">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-navy-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-center text-xs text-navy-400 sm:px-8 lg:px-10">
          <p>© {new Date().getFullYear()} MiDukandar. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
