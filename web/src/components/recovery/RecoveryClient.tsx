"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  FileLock2,
  Fingerprint,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { apiFetch, clearSession } from "@/lib/api";
import RecoveryTopBar from "./RecoveryTopBar";
import MerchantSidebar from "./MerchantSidebar";
import StepIdentity from "./StepIdentity";
import StepOtp from "./StepOtp";
import StepNewPin from "./StepNewPin";
import type { MerchantContext, Method, Step } from "./types";

interface InitiateResponse {
  ok: boolean;
  method: Method;
  expiresIn?: number;
  channels?: string[];
  matchedMobile?: string;
}

interface VerifyOtpResponse {
  ok: boolean;
  resetToken: string;
  expiresInSeconds?: number;
}

interface ResetPinResponse {
  ok: boolean;
  auditId: string;
  invalidated?: { posTerminals: boolean; staffSessions: boolean; mobileSessions: boolean; branches: boolean };
}

const STEP_LABELS: { n: Step; label: string }[] = [
  { n: 1, label: "Identity" },
  { n: 2, label: "OTP" },
  { n: 3, label: "New PIN" },
];

export default function RecoveryClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<Method>("mobile");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");

  const [merchant, setMerchant] = useState<MerchantContext | null>(null);
  const [merchantChecking, setMerchantChecking] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [expiresIn, setExpiresIn] = useState(300);
  const [otpSession, setOtpSession] = useState(0);
  const [resetToken, setResetToken] = useState("");

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [initiating, setInitiating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<ResetPinResponse | null>(null);
  const [redirectIn, setRedirectIn] = useState(5);

  const loadMerchantContext = useCallback(async (mob: string) => {
    setMerchantChecking(true);
    try {
      const res = await apiFetch<{ ok: boolean; merchant?: MerchantContext }>(
        `/api/merchant/verify-context?mobile=${encodeURIComponent(mob)}`,
        { noAuth: true },
      );
      if (res.ok && res.merchant) setMerchant(res.merchant);
    } catch {
      // silently ignore - sidebar keeps its empty state
    } finally {
      setMerchantChecking(false);
    }
  }, []);

  const handleMatched = useCallback((_mob: string, ctx: MerchantContext) => {
    setMerchant(ctx);
  }, []);

  const handleClearMatch = useCallback(() => {
    setMerchant(null);
  }, []);

  const handleContinue = async () => {
    setInitiating(true);
    setError(null);
    try {
      const res = await apiFetch<InitiateResponse>("/api/auth/recovery/initiate", {
        noAuth: true,
        body: {
          method,
          ...(method === "mobile" ? { mobile } : { email }),
        },
      });
      const id = res.matchedMobile ?? (method === "mobile" ? mobile : email);
      setIdentifier(id);
      setExpiresIn(res.expiresIn ?? 300);
      setOtpSession((s) => s + 1);
      setStep(2);
      if (method === "email" && res.matchedMobile) {
        void loadMerchantContext(res.matchedMobile);
      }
      toast.success("Recovery code dispatched via SMS & WhatsApp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start recovery. Try again.");
    } finally {
      setInitiating(false);
    }
  };

  const handleVerify = async (otp: string) => {
    if (otp.trim().length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await apiFetch<VerifyOtpResponse>("/api/auth/recovery/verify-otp", {
        noAuth: true,
        body: {
          identifier,
          otp: otp.trim(),
        },
      });
      setResetToken(res.resetToken);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await apiFetch<InitiateResponse>("/api/auth/recovery/initiate", {
        noAuth: true,
        body: {
          method,
          ...(method === "mobile" ? { mobile } : { email }),
        },
      });
      setExpiresIn(res.expiresIn ?? 300);
      setOtpSession((s) => s + 1);
      toast.success("New code sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setResending(false);
    }
  };

  const handleSubmitPin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<ResetPinResponse>("/api/auth/recovery/reset-pin", {
        noAuth: true,
        body: {
          resetToken,
          newPin: pin,
          confirmPin,
        },
      });
      clearSession();
      setResetResult(res);
      toast.success("New PIN secured. All other sessions signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update PIN. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!resetResult) return;
    if (redirectIn <= 0) {
      router.push("/login");
      return;
    }
    const t = setTimeout(() => setRedirectIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resetResult, redirectIn, router]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-navy-50 via-white to-royal-50/40">
      <RecoveryTopBar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
          {/* LEFT - Recovery flow card */}
          <div className="rounded-2xl border border-navy-100 bg-white shadow-sm">
            <div className="border-b border-navy-100 px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1 text-[11px] font-bold text-white">
                      <Fingerprint className="size-3.5 text-royal-400" />
                      Terminal Authorization Recovery
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-royal-200 bg-royal-50 px-3 py-1 text-[11px] font-bold text-royal-700">
                      <LockKeyhole className="size-3.5" />
                      256-Bit Vault Protocol
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-navy-900 sm:text-[26px]">
                    Reset PIN or Password
                  </h1>
                  <p className="mt-1 text-sm text-navy-500">
                    PIN किंवा पासवर्ड रीसेट करा · PIN या पासवर्ड को रीसेट करें
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                    <ShieldCheck className="size-3.5" />
                    Audit-Protected Reset
                  </span>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-500 hover:text-royal-600"
                  >
                    <ArrowLeft className="size-3.5" />
                    Return to Login
                  </Link>
                </div>
              </div>

              {/* Stepper */}
              <div className="mt-6 flex items-center">
                {STEP_LABELS.map((s, i) => {
                  const done = step > s.n;
                  const current = step === s.n;
                  return (
                    <Fragment key={s.n}>
                      {i > 0 && (
                        <div
                          className={`mx-2 h-0.5 flex-1 rounded-full sm:mx-3 ${
                            step >= s.n ? "bg-royal-500" : "bg-navy-200"
                          }`}
                        />
                      )}
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold transition-all ${
                            done
                              ? "bg-green-600 text-white"
                              : current
                                ? "bg-royal-500 text-white ring-4 ring-royal-100"
                                : "bg-navy-100 text-navy-400"
                          }`}
                        >
                          {done ? <Check className="size-4" /> : s.n}
                        </span>
                        <span
                          className={`mt-1.5 text-[10px] font-semibold sm:text-[11px] ${
                            current ? "text-royal-700" : done ? "text-green-700" : "text-navy-400"
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-6 sm:px-7 sm:py-7">
              {!resetResult ? (
                <>
                  {step === 1 && (
                    <StepIdentity
                      method={method}
                      setMethod={setMethod}
                      mobile={mobile}
                      setMobile={setMobile}
                      email={email}
                      setEmail={setEmail}
                      onMatched={handleMatched}
                      onClearMatch={handleClearMatch}
                      onContinue={handleContinue}
                      loading={initiating}
                    />
                  )}

                  {step === 2 && (
                    <StepOtp
                      key={`${identifier}-${otpSession}`}
                      identifier={identifier}
                      method={method}
                      expiresIn={expiresIn}
                      verifying={verifying}
                      resending={resending}
                      error={error}
                      onVerify={handleVerify}
                      onResend={handleResend}
                      onBack={() => {
                        setStep(1);
                        setError(null);
                      }}
                    />
                  )}

                  {step === 3 && (
                    <StepNewPin
                      pin={pin}
                      setPin={setPin}
                      confirmPin={confirmPin}
                      setConfirmPin={setConfirmPin}
                      submitting={submitting}
                      error={error}
                      onSubmit={handleSubmitPin}
                      onBack={() => {
                        setStep(2);
                        setError(null);
                      }}
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center py-4 text-center">
                  <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="size-8 text-green-600" />
                  </span>
                  <h2 className="font-display text-xl font-bold text-navy-900">New PIN Secured</h2>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-navy-500">
                    Your counter PIN has been updated and logged in the Dukan Ledger
                    <span className="ml-1 rounded bg-navy-50 px-1.5 py-0.5 font-mono text-[10px] text-navy-600">
                      {resetResult.auditId}
                    </span>
                  </p>
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-navy-100 bg-navy-50/60 px-4 py-3 text-left">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
                    <p className="text-[11px] leading-relaxed text-navy-600">
                      All active billing sessions and MiDukandar mobile sessions were
                      signed out for your business. Use the new PIN to unlock this terminal.
                    </p>
                  </div>
                  <div className="mt-5 flex w-full max-w-sm flex-col items-center gap-2.5">
                    <Link
                      href="/login"
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-900 font-display text-sm font-bold text-white transition-colors hover:bg-navy-800"
                    >
                      <LogIn className="size-4" />
                      Return to Login
                    </Link>
                    <p className="text-[11px] text-navy-400">
                      Redirecting to login in {redirectIn}s&hellip;
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - Merchant verification sidebar */}
          <MerchantSidebar merchant={merchant} checking={merchantChecking} />
        </div>
      </main>

      <footer className="border-t border-navy-100 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:px-8">
          <p className="text-center text-[10px] leading-relaxed text-navy-300 lg:text-left">
            GST Suvidha Provider · RBI-compliant transaction processing · 256-Bit Financial Vault Security
            <br />
            &copy; {new Date().getFullYear()} MiDukandar - All data stored on Indian servers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <Link href="/pricing" className="rounded-full border border-navy-700/60 bg-navy-800/60 px-2.5 py-1 text-[10px] font-medium text-navy-200 transition-colors hover:border-royal-400/60 hover:text-white">Pricing</Link>
            <Link href="/terms" className="rounded-full border border-navy-700/60 bg-navy-800/60 px-2.5 py-1 text-[10px] font-medium text-navy-200 transition-colors hover:border-royal-400/60 hover:text-white">Terms of Service</Link>
            {[
              { icon: <FileLock2 className="size-3.5" />, label: "GST Suvidha Provider" },
              { icon: <ShieldCheck className="size-3.5" />, label: "256-Bit Vault" },
              { icon: <Sparkles className="size-3.5" />, label: "RBI Compliant" },
            ].map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-navy-700/60 bg-navy-800/60 px-2.5 py-1 text-[10px] font-medium text-navy-200"
              >
                <span className="text-royal-400">{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}