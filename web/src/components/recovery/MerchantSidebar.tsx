"use client";

import { AlertCircle, BadgeCheck, Fingerprint, LifeBuoy, MessageCircle, Phone, RefreshCcw, ShieldCheck, Store, Timer, Wallet } from "lucide-react";
import { formatINR, formatQty } from "@/lib/format";
import type { MerchantContext } from "./types";

interface MerchantSidebarProps {
  merchant: MerchantContext | null;
  checking?: boolean;
}

export default function MerchantSidebar({ merchant, checking = false }: MerchantSidebarProps) {
  return (
    <aside className="flex flex-col gap-4">
      {merchant ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-navy-100 bg-navy-50/60 px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-navy-500">
                Authorized Merchant Verification
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-600" />
                </span>
                Active State
              </span>
            </div>

            <div className="px-4 py-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500 to-royal-700 font-display text-lg font-bold text-white">
                  {merchant.ownerInitials}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-base font-bold text-navy-900">
                    {merchant.ownerName}
                    <BadgeCheck className="size-4 text-royal-600" />
                  </p>
                  <p className="flex items-center gap-1 text-sm text-navy-500">
                    <Store className="size-3.5" />
                    {merchant.storeName}, {merchant.city}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-3">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                    GSTIN
                  </p>
                  <p className="font-mono text-xs font-semibold text-navy-800">{merchant.gstin}</p>
                </div>
                <div className="rounded-xl border border-navy-100 bg-navy-50/50 p-3">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                    Terminal ID
                  </p>
                  <p className="font-mono text-xs font-semibold text-navy-800">{merchant.terminalId}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border-t border-navy-100 bg-navy-100">
              <div className="bg-white px-4 py-3">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                  <ShieldCheck className="size-3 text-green-600" />
                  Ledger Status
                </p>
                <p className="mt-0.5 font-display text-sm font-bold text-green-700">
                  {merchant.ledgerStatus === "Online" ? "Safe · Online" : "Safe · Synced Offline"}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                  Today&rsquo;s Invoices
                </p>
                <p className="mt-0.5 font-display text-sm font-bold text-navy-900">
                  {formatQty(merchant.todayInvoices)}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                  <Wallet className="size-3 text-royal-600" />
                  Pending Udhaari
                </p>
                <p className="mt-0.5 font-display text-sm font-bold text-navy-900">
                  {formatINR(merchant.pendingUdhaari)}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-400">
                  Receipts
                </p>
                <p className="mt-0.5 font-display text-sm font-bold text-navy-900">
                  {formatQty(merchant.receipts)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 border-t border-navy-100 bg-blue-50/70 px-4 py-3">
              <RefreshCcw className="mt-0.5 size-3.5 shrink-0 text-blue-600" />
              <p className="text-[11px] leading-relaxed text-blue-900">
                Offline billing is stored safely on this terminal and will re-sync to the ledger
                automatically after your new PIN login.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-navy-500">
              Storeowner Protection Measures
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-50">
                  <Fingerprint className="size-3.5 text-green-700" />
                </span>
                <p className="text-xs leading-relaxed text-navy-600">
                  <span className="font-semibold text-navy-800">Biometric / SMS 2-step verification</span>
                  <br />
                  Prevents unauthorized staff PIN modifications.
                </p>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-royal-50">
                  <Phone className="size-3.5 text-royal-700" />
                </span>
                <p className="text-xs leading-relaxed text-navy-600">
                  <span className="font-semibold text-navy-800">Real-time SMS alert</span>
                  <br />
                  Dispatched instantly to the proprietor&rsquo;s personal phone.
                </p>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-navy-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-navy-500">
                <LifeBuoy className="size-3.5 text-royal-600" />
                Having Trouble?
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-600" />
                </span>
                Operating Live
              </span>
            </div>

            <a
              href="tel:1800629393852"
              className="mb-3 flex items-center justify-between rounded-xl border border-navy-100 bg-navy-50/60 px-3.5 py-2.5 hover:border-royal-300"
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-navy-800">
                <Phone className="size-4 text-royal-600" />
                <span className="font-mono">1800-MI-DUKAN</span>
              </span>
              <span className="rounded-full bg-royal-100 px-2 py-0.5 text-[10px] font-bold text-royal-700">
                Toll-free 24/7
              </span>
            </a>

            <a
              href="https://wa.me/918000629385"
              target="_blank"
              rel="noreferrer"
              className="mb-3 flex items-center justify-between rounded-xl border border-navy-100 bg-navy-50/60 px-3.5 py-2.5 hover:border-green-300"
            >
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-navy-800">
                <MessageCircle className="size-4 text-green-600" />
                WhatsApp Support Desk
              </span>
              <span className="text-[10px] text-navy-400">Chat now</span>
            </a>

            <div className="flex items-center justify-between border-t border-navy-100 pt-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-navy-500">
                <Timer className="size-3.5 text-navy-400" />
                Avg. wait:{" "}
                <span className="font-semibold text-navy-800">&lt; 2 min</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-navy-400">
                <AlertCircle className="size-3" /> Hindi · Marathi · English
              </span>
            </div>
          </section>
        </>
      ) : (
        <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-white/70 px-6 py-10 text-center shadow-sm">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50">
            <Store className="size-5 text-navy-400" />
          </span>
          <p className="font-display text-sm font-semibold text-navy-900">Verify your identity</p>
          <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-navy-500">
            {checking ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 animate-spin rounded-full border-2 border-navy-300 border-t-royal-600" />
                Checking registered store&hellip;
              </span>
            ) : (
              "Enter your registered store mobile number to load the verified merchant panel."
            )}
          </p>
        </section>
      )}
    </aside>
  );
}