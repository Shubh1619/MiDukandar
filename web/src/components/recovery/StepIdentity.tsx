"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, Mail, MessageCircle, PhoneOff, SearchX, Store, UserX, Zap } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { MerchantContext, MerchantContextResponse, Method } from "./types";

const INVALID_MOBILE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LookupState = "idle" | "checking" | "matched" | "not-found";

interface StepIdentityProps {
  method: Method;
  setMethod: (m: Method) => void;
  mobile: string;
  setMobile: (m: string) => void;
  email: string;
  setEmail: (e: string) => void;
  onMatched: (mobile: string, merchant: MerchantContext) => void;
  onClearMatch: () => void;
  onContinue: () => Promise<void>;
  loading: boolean;
}

export default function StepIdentity({
  method,
  setMethod,
  mobile,
  setMobile,
  email,
  setEmail,
  onMatched,
  onClearMatch,
  onContinue,
  loading,
}: StepIdentityProps) {
  const [lookup, setLookup] = useState<LookupState>("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [matchedMerchant, setMatchedMerchant] = useState<MerchantContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const lookupMobile = useCallback(
    async (value: string) => {
      if (!INVALID_MOBILE.test(value)) {
        setLookup("idle");
        setLookupError(null);
        return;
      }
      setLookup("checking");
      setLookupError(null);
      try {
        const res = await apiFetch<MerchantContextResponse>(
          `/api/merchant/verify-context?mobile=${encodeURIComponent(value)}`,
          { noAuth: true },
        );
        if (res.ok && res.merchant) {
          setLookup("matched");
          setMatchedMerchant(res.merchant);
          onMatched(value, res.merchant);
        } else {
          setLookup("not-found");
          setLookupError("No registered store matches this number");
        }
      } catch {
        setLookup("not-found");
        setLookupError("No registered store matches this number");
      }
    },
    [onMatched],
  );

  const switchTab = (m: Method) => {
    setMethod(m);
    setLookup("idle");
    setLookupError(null);
    setMatchedMerchant(null);
    setMobile("");
    setEmail("");
    onClearMatch();
  };

  const notYourDukan = () => {
    setMobile("");
    setLookup("idle");
    setLookupError(null);
    setMatchedMerchant(null);
    onClearMatch();
  };

  const mobileMatch = lookup === "matched";
  const emailValid = EMAIL_RE.test(email.trim());
  const canContinue = method === "mobile" ? mobileMatch : emailValid;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-navy-400">
          Recover using
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-navy-50 p-1">
          <button
            type="button"
            onClick={() => switchTab("mobile")}
            aria-pressed={method === "mobile"}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-display text-sm font-semibold transition-all ${
              method === "mobile" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700"
            }`}
          >
            <Zap className={`size-4 ${method === "mobile" ? "text-royal-600" : ""}`} />
            Mobile OTP
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                method === "mobile" ? "bg-royal-100 text-royal-700" : "bg-navy-100 text-navy-400"
              }`}
            >
              fastest
            </span>
          </button>
          <button
            type="button"
            onClick={() => switchTab("email")}
            aria-pressed={method === "email"}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-display text-sm font-semibold transition-all ${
              method === "email" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700"
            }`}
          >
            <Mail className={`size-4 ${method === "email" ? "text-royal-600" : ""}`} />
            Registered Email
          </button>
        </div>
      </div>

      {method === "mobile" ? (
        <div>
          <label
            htmlFor="recovery-mobile"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-navy-400"
          >
            Registered Store Mobile Number
          </label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-navy-200 bg-navy-50 px-3.5 font-display text-sm font-semibold text-navy-700">
              +91
            </span>
            <input
              id="recovery-mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={mobile}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setMobile(digits);
                setLookup("idle");
                setLookupError(null);
                if (timerRef.current) clearTimeout(timerRef.current);
                if (digits.length === 10) {
                  timerRef.current = setTimeout(() => void lookupMobile(digits), 600);
                }
              }}
              placeholder="98765 43210"
              className={`h-11 w-full rounded-r-lg border bg-white px-3 font-display text-sm tracking-wide text-navy-900 outline-none transition-colors focus:border-navy-500 ${
                mobileMatch ? "border-green-300" : "border-navy-200"
              }`}
            />
          </div>

          <div className="mt-2.5 min-h-[24px]">
            {lookup === "checking" && (
              <p className="flex items-center gap-1.5 text-xs text-navy-500">
                <Loader2 className="size-3.5 animate-spin" />
                Checking registered store&hellip;
              </p>
            )}
            {lookup === "matched" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
                  <BadgeCheck className="size-3.5" />
                  Store Owner Match
                </span>
                <button
                  type="button"
                  onClick={notYourDukan}
                  className="text-[11px] font-semibold text-royal-600 hover:text-royal-700"
                >
                  Not your dukan?
                </button>
              </div>
            )}
            {lookup === "not-found" && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                <UserX className="size-3.5" />
                {lookupError}
              </p>
            )}
          </div>

          {mobileMatch && matchedMerchant && (
            <p className="mt-1 flex items-center gap-1.5 rounded-lg bg-navy-50 px-3 py-2 text-xs font-medium text-navy-600">
              <Store className="size-3.5 text-royal-600" />
              Linked Merchant:{" "}
              <span className="font-semibold text-navy-900">
                {matchedMerchant.storeName}, {matchedMerchant.city}
              </span>
            </p>
          )}
        </div>
      ) : (
        <div>
          <label
            htmlFor="recovery-email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-navy-400"
          >
            Registered Email Address
          </label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-navy-200 bg-navy-50 px-3.5">
              <Mail className="size-4 text-navy-500" />
            </span>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@yourdukan.store"
              className={`h-11 w-full rounded-r-lg border bg-white px-3 font-display text-sm tracking-wide text-navy-900 outline-none transition-colors focus:border-navy-500 ${
                emailValid ? "border-green-300" : "border-navy-200"
              }`}
            />
          </div>
          <div className="mt-2.5 min-h-[24px]">
            {emailValid && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
                <BadgeCheck className="size-3.5" />
                Registered Email Match
              </span>
            )}
            {emailValid && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-navy-500">
                <SearchX className="size-3.5" />
                We&rsquo;ll load your store once you continue
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-navy-50 px-3.5 py-3 text-[11px] leading-relaxed text-navy-500">
        <MessageCircle className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        A 6-digit code will be dispatched via <span className="font-semibold text-navy-700">SMS &amp; WhatsApp</span> to the
        registered contact. One-time recovery never exposes your current PIN.
      </div>

      <button
        type="button"
        onClick={() => void onContinue()}
        disabled={!canContinue || loading}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          canContinue ? "bg-navy-900 hover:bg-navy-800" : "bg-navy-400"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Dispatching OTP&hellip;
          </>
        ) : method === "mobile" ? (
          canContinue ? (
            <>
              <MessageCircle className="size-4" />
              Send OTP &amp; Continue
            </>
          ) : (
            <>
              <PhoneOff className="size-4" />
              Enter a registered number
            </>
          )
        ) : (
          <>
            <Mail className="size-4" />
            Send OTP &amp; Continue
          </>
        )}
      </button>
    </div>
  );
}