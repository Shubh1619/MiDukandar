"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#benefits", label: "Benefits" },
  { href: "#faq", label: "FAQ" },
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms of Service" },
  { href: "#contact", label: "Contact" },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);

  const scrollTo = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setOpen(false);
        return;
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-navy-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="MiDukandar home">
          <span className="flex h-11 shrink-0 items-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-navy-100">
            <Image src="/logo.png" alt="MiDukandar - Smart Business" width={160} height={56} className="h-7 w-auto object-contain" />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block font-display text-sm font-bold text-navy-950">MiDukandar</span>
            <span className="block truncate text-[10px] text-navy-400">MiDukandar - Smart Business</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-navy-600 lg:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                if (link.href.startsWith("#")) {
                  e.preventDefault();
                  scrollTo(link.href);
                }
              }}
              className="transition-colors hover:text-royal-600"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-50 hover:text-navy-950 sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl bg-navy-950 px-3.5 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgb(9_26_51/0.7)] transition-all hover:bg-navy-800 sm:px-4 sm:text-sm"
          >
            Get Started
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl p-2.5 text-navy-700 transition-colors hover:bg-navy-50 lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-navy-100 bg-white lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-5 py-2 sm:px-8" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  if (link.href.startsWith("#")) {
                    e.preventDefault();
                    scrollTo(link.href);
                  } else {
                    setOpen(false);
                  }
                }}
                className="px-1 py-2.5 text-sm font-semibold text-navy-700 transition-colors hover:text-royal-600"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-navy-100 pt-3">
              <Link href="/login" className="rounded-xl px-1 py-2.5 text-sm font-semibold text-navy-700">
                Login
              </Link>
              <Link href="/login" className="rounded-xl bg-navy-950 px-4 py-2.5 text-center text-sm font-bold text-white">
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
