"use client";

import { useState } from "react";
import { Asterisk, Loader2, MessageSquareText, RotateCcw } from "lucide-react";
import OtpInput from "@/components/login/OtpInput";
import { useCountdown } from "@/lib/use-countdown";
import type { Method } from "./types";

interface StepOtpProps {
  identifier: string;
  method: Method;
  expiresIn: number;
  verifying: boolean;
  resending: boolean;
  error: string | null;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
}

function formatMss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function StepOtp({
  identifier,
  method,
  expiresIn,
  verifying,
  resending,
  error,
  onVerify,
  onResend,
  onBack,
}: StepOtpProps) {
  const { secondsLeft } = useCountdown(expiresIn);
  const [otp, setOtp] = useState("");

  const virtually = secondsLeft === 0;
  const canVerify = otp.trim().length === 6 && !verifying;

  return (
    <div className="space-y-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">
          Enter the 6-digit code
        </p>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
            virtually ? "bg-red-50 text-red-600 countdown-pulse" : "bg-navy-100 text-navy-700"
          }`}
        >
          {virtually ? "EXPIRED" : formatMss(secondsLeft)}
        </span>
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-navy-50 px-2.5 py-1 font-display text-sm font-semibold text-navy-700">
          {method === "mobile" ? `+91 ${identifier}` : identifier}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-navy-500">
          <MessageSquareText className="size-3.5 text-emerald-600" />
          Dispatched via SMS &amp; WhatsApp
        </span>
      </div>

      <OtpInput
        value={otp}
        onChange={setOtp}
        onComplete={() => void onVerify(otp)}
        disabled={verifying}
        error={!!error}
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => void onVerify(otp)}
          disabled={!canVerify}
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            canVerify ? "bg-navy-900 hover:bg-navy-800" : "bg-navy-400"
          }`}
        >
          {verifying ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying&hellip;
            </>
          ) : (
            <>
              <Asterisk className="size-4" />
              Verify &amp; Continue
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={secondsLeft > 0 || resending}
          className="ml-3 inline-flex items-center gap-1.5 rounded-lg border border-navy-200 px-3.5 text-xs font-semibold text-navy-600 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {resending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          Resend Code
        </button>
      </div>

      {secondsLeft > 0 && (
        <p className="text-[11px] text-navy-400">
          Resend available in <span className="font-semibold text-navy-600">{formatMss(secondsLeft)}</span>
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="text-xs font-semibold text-royal-600 hover:text-royal-700"
      >
        &larr; Use a different number / email
      </button>
    </div>
  );
}