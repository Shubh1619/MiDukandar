"use client";

import { useState } from "react";
import { Check, CircleX, Eye, EyeOff, Loader2, LogIn, ShieldAlert, ShieldCheck } from "lucide-react";
import OtpInput from "@/components/login/OtpInput";

const REPEATED_PIN = /^(\d)\1{3}$/;
const ASCENDING_SEQUENCE = /^(0123|1234|2345|3456|4567|5678|6789)$/;
const DESCENDING_SEQUENCE = /^(9876|8765|7654|6543|5432|4321|3210)$/;
const BIRTH_YEAR_PIN = /^(19|20)\d{2}$/;

interface StepNewPinProps {
  pin: string;
  setPin: (v: string) => void;
  confirmPin: string;
  setConfirmPin: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
  onBack: () => void;
}

type Strength = { label: string; tone: "red" | "amber" | "green"; fill: number };

export default function StepNewPin({
  pin,
  setPin,
  confirmPin,
  setConfirmPin,
  submitting,
  error,
  onSubmit,
  onBack,
}: StepNewPinProps) {
  const [showPin, setShowPin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const digits = pin.replace(/\D/g, "").slice(0, 4);
  const confirmDigits = confirmPin.replace(/\D/g, "").slice(0, 4);

  const distinct = new Set(digits.split("")).size;
  const hasPattern = REPEATED_PIN.test(digits) || ASCENDING_SEQUENCE.test(digits) || DESCENDING_SEQUENCE.test(digits);
  const isBirthYear = BIRTH_YEAR_PIN.test(digits);
  const complete = digits.length === 4;

  const checks = [
    { label: "Not matching 1234 or 0000", pass: !hasPattern },
    { label: "No birth-year patterns", pass: !isBirthYear },
    { label: "At least 3 unique digits", pass: distinct >= 3 },
  ];

  let strength: Strength = { label: "Not set", tone: "red", fill: 0 };
  if (complete) {
    const score = checks.filter((c) => c.pass).length;
    if (score >= 3) strength = { label: "Strong", tone: "green", fill: 3 };
    else if (score === 2) strength = { label: "Medium", tone: "amber", fill: 2 };
    else strength = { label: "Weak", tone: "red", fill: 1 };
  }

  const strengthBar =
    strength.tone === "green" ? "bg-green-500" : strength.tone === "amber" ? "bg-amber-500" : "bg-red-500";

  const matched = complete && confirmDigits.length === 4 && digits === confirmDigits;
  const canSubmit =
    complete && confirmDigits.length === 4 && digits === confirmDigits && strength.fill >= 3 && !submitting;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-base font-bold text-navy-900">Set New 4-Digit Counter PIN</h3>
        <p className="mt-0.5 text-xs text-navy-500">
          Used by staff to unlock billing at the counter terminal. Should be easy for you, hard for others.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-navy-400">
              New 4-Digit PIN
            </label>
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy-500 hover:text-navy-700"
            >
              {showPin ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPin ? "Hide" : "Show"}
            </button>
          </div>
          <OtpInput
            length={4}
            value={digits}
            onChange={(v) => setPin(v)}
            disabled={submitting}
            obscure={!showPin}
            error={complete && strength.fill < 3}
          />

          <div className="mt-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      strength.fill >= i ? strengthBar : "bg-navy-100"
                    }`}
                  />
                ))}
              </div>
              <span
                className={`ml-2 font-display text-[11px] font-bold capitalize ${
                  strength.tone === "green"
                    ? "text-green-700"
                    : strength.tone === "amber"
                      ? "text-amber-700"
                      : "text-red-600"
                }`}
              >
                {complete ? strength.label : "-"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-navy-400">
              Confirm New PIN
            </label>
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? "Hide PIN" : "Show PIN"}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy-500 hover:text-navy-700"
            >
              {showConfirm ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
          <OtpInput
            length={4}
            value={confirmDigits}
            onChange={setConfirmPin}
            disabled={submitting}
            obscure={!showConfirm}
            error={confirmDigits.length === 4 && digits !== confirmDigits}
          />

          <div className="mt-3 min-h-[18px]">
            {confirmDigits.length === 4 && digits !== confirmDigits && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
                <CircleX className="size-3.5" />
                PINs don&rsquo;t match
              </p>
            )}
            {matched && (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-green-700">
                <Check className="size-3.5" />
                PINs match
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {checks.map((c) => {
          const decided = complete;
          return (
            <span
              key={c.label}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                !decided
                  ? "border-navy-100 bg-navy-50/50 text-navy-400"
                  : c.pass
                    ? "border-green-100 bg-green-50 text-green-700"
                    : "border-red-100 bg-red-50 text-red-700"
              }`}
            >
              {!decided ? (
                <span className="size-3.5 rounded-full border border-navy-200" />
              ) : c.pass ? (
                <Check className="size-3.5" />
              ) : (
                <CircleX className="size-3.5" />
              )}
              {c.label}
            </span>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-royal-100 bg-royal-50 px-4 py-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-royal-700" />
        <div>
          <p className="font-display text-xs font-bold text-navy-900">Terminal Protection Protocol</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-navy-600">
            Resetting credentials will log out all other active billing sessions and
            MiDukandar mobile sessions across all branches.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <div>
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canSubmit}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg font-display text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            canSubmit ? "bg-royal-600 hover:bg-royal-700" : "bg-navy-300"
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Securing terminal&hellip;
            </>
          ) : (
            <>
              <LogIn className="size-4" />
              Update PIN &amp; Login
            </>
          )}
        </button>
        <p className="mt-2.5 flex items-center justify-center gap-1 text-center text-[11px] text-navy-500">
          <ShieldCheck className="size-3 text-emerald-600" />
          By updating your PIN, you authorize an audit record update in your Dukan Ledger
        </p>
        <div className="mt-1.5 text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-royal-600 hover:text-royal-700"
          >
            &larr; Back to OTP
          </button>
        </div>
      </div>
    </div>
  );
}