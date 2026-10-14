"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  KeyRound,
  LoaderCircle,
  Mail,
  ReceiptText,
  ShieldCheck,
  Store,
  TrendingUp,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth, type AuthUser, type StoreInfo } from "@/lib/auth-store";
import { useSaAuth } from "@/lib/superadmin-store";
import { useCountdown } from "@/lib/use-countdown";
import OtpInput from "./OtpInput";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = "email" | "password" | "otp";
type Notice = {
  kind: "account-not-found" | "api-error" | "network-error";
  message?: string;
};

interface RequestOtpResponse {
  ok: boolean;
  expiresInSeconds: number;
  emailSent: boolean;
  devOtp?: string;
}

interface VerifyOtpResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthUser;
}

interface LoginKindResponse {
  kind: "superadmin" | "tenant";
}

interface SuperadminLoginResponse {
  expiresInSeconds: number;
  superadmin: { id: string; email: string; name: string };
}

const mobileFeatures = [
  { icon: ReceiptText, title: "Fast Billing" },
  { icon: Boxes, title: "Smart Inventory" },
  { icon: TrendingUp, title: "Business Insights" },
];

export default function LoginClient() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const store = useAuth((s) => s.store);
  const ready = useAuth((s) => s.ready);
  const init = useAuth((s) => s.init);
  const setUserAndTokens = useAuth((s) => s.setUserAndTokens);
  const setStore = useAuth((s) => s.setStore);
  const setSaSession = useSaAuth((s) => s.setSession);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const countdown = useCountdown(0);
  const secondsLeft = countdown.secondsLeft;

  const inFlight = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // Silent session restore: with a valid refresh cookie (from a previous login,
  // a browser restart, or another tab logging in) the user lands in the app
  // without ever seeing the login form. This pre-warms `ready` so a successful
  // OTP login also renders the app immediately.
  useEffect(() => {
    void init();
  }, [init]);

  // Redirect away from /login when a session is (silently) active. Guarded so
  // it never fires mid-flow: the OTP/password steps and any in-flight request
  // mean the user is intentionally logging in, and LoginClient's own submit
  // handlers own the navigation there.
  useEffect(() => {
    if (!ready || !user) return;
    if (step !== "email" || sending || verifying) return;
    router.replace(user && store ? "/dashboard" : "/onboard");
  }, [ready, user, store, step, sending, verifying, router]);

  const requestCode = useCallback(
    async (address: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSending(true);
      setNotice(null);
      setFieldError(null);
      try {
        const res = await apiFetch<RequestOtpResponse>("/api/auth/otp/request", {
          method: "POST",
          body: { email: address, purpose: "LOGIN" },
          noAuth: true,
        });
        setEmail(address);
        setOtp(res.devOtp ?? "");
        setDevHint(res.devOtp ?? null);
        countdown.reset(res.expiresInSeconds || 120);
        advanceTimer.current = setTimeout(() => setStep("otp"), 250);
      } catch (err) {
        if (err instanceof ApiError && err.code === "ACCOUNT_NOT_FOUND") {
          setNotice({ kind: "account-not-found" });
        } else if (err instanceof TypeError) {
          setNotice({ kind: "network-error" });
        } else if (err instanceof ApiError && err.status >= 500) {
          setNotice({
            kind: "api-error",
            message: "Our servers hit a snag. Please try again in a moment.",
          });
        } else {
          setNotice({
            kind: "api-error",
            message:
              err instanceof ApiError && err.message && err.message !== `HTTP ${err.status}`
                ? err.message
                : "Something went wrong. Please try again.",
          });
        }
      } finally {
        inFlight.current = false;
        setSending(false);
      }
    },
    [],
  );

  const verifyCode = useCallback(
    async (code?: string) => {
      const value = (code ?? otp).trim();
      if (value.length < 4) return;
      setVerifying(true);
      setNotice(null);
      try {
        const res = await apiFetch<VerifyOtpResponse>("/api/auth/otp/verify", {
          method: "POST",
          body: { email, otp: value, purpose: "LOGIN" },
          noAuth: true,
        });
        setUserAndTokens(res.user, res.accessToken);
        try {
          const me = await apiFetch<{ user: AuthUser; store: StoreInfo | null }>("/api/auth/me");
          setUserAndTokens(me.user, res.accessToken);
          if (me.store) setStore(me.store);
          toast.success("Signed in");
          router.replace(me.store ? "/dashboard" : "/onboard");
        } catch {
          toast.success("Signed in");
          router.replace("/onboard");
        }
      } catch (err) {
        if (err instanceof TypeError) {
          setNotice({ kind: "network-error", message: "We couldn't reach the server. Check your connection and try again." });
        } else {
          setNotice({
            kind: "api-error",
            message:
              err instanceof ApiError && err.message && err.message !== `HTTP ${err.status}`
                ? err.message
                : "Verification failed. Please try again.",
          });
        }
        setOtp("");
      } finally {
        setVerifying(false);
      }
    },
    [email, otp, router, setUserAndTokens, setStore],
  );

  const superadminLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const address = email.trim().toLowerCase();
      if (!password) {
        setFieldError("Enter your password.");
        return;
      }
      setVerifying(true);
      setNotice(null);
      setFieldError(null);
      try {
        const res = await apiFetch<SuperadminLoginResponse>("/api/superadmin/auth/login", {
          method: "POST",
          body: { email: address, password },
          noAuth: true,
        });
        // No token to handle: the httpOnly `mz_sa` cookie is the credential.
        setSaSession(res.superadmin);
        toast.success("Signed in");
        router.replace("/superadmin/dashboard");
      } catch (err) {
        if (err instanceof TypeError) {
          setNotice({ kind: "network-error", message: "We couldn't reach the server. Check your connection and try again." });
        } else {
          setNotice({
            kind: "api-error",
            message:
              err instanceof ApiError &&
              err.message &&
              err.code !== "UNAUTHORIZED" &&
              err.message !== `HTTP ${err.status}`
                ? err.message
                : "Invalid email or password.",
          });
        }
      } finally {
        setVerifying(false);
      }
    },
    [email, password, router, setSaSession],
  );

  const submitEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const value = email.trim().toLowerCase();
      if (!value) {
        setFieldError("Enter your email address.");
        return;
      }
      if (!EMAIL_RE.test(value)) {
        setFieldError("Enter a valid email address.");
        return;
      }
      setFieldError(null);
      if (inFlight.current) return;
      inFlight.current = true;
      setSending(true);
      setNotice(null);
      try {
        const kind = await apiFetch<LoginKindResponse>("/api/auth/login-kind", {
          method: "POST",
          body: { identifier: value },
          noAuth: true,
        });
        if (kind.kind === "superadmin") {
          setEmail(value);
          setPassword("");
          setStep("password");
          return;
        }
        inFlight.current = false;
        await requestCode(value);
      } catch (err) {
        if (err instanceof TypeError) {
          setNotice({ kind: "network-error" });
        } else if (err instanceof ApiError && err.status >= 500) {
          setNotice({ kind: "api-error", message: "Our servers hit a snag. Please try again in a moment." });
        } else {
          setNotice({
            kind: "api-error",
            message: err instanceof ApiError && err.message && err.message !== `HTTP ${err.status}` ? err.message : "Something went wrong. Please try again.",
          });
        }
      } finally {
        inFlight.current = false;
        setSending(false);
      }
    },
    [email, requestCode],
  );

  const changeEmail = useCallback(() => {
    setStep("email");
    setOtp("");
    setPassword("");
    setDevHint(null);
    countdown.reset(0);
    setNotice(null);
    setFieldError(null);
  }, []);

  const continueWithOtp = useCallback(() => {
    changeEmail();
    void requestCode(email);
  }, [changeEmail, email, requestCode]);

  // While the silent session check is in flight, show a brief spinner instead
  // of flashing the login form at a user who already has a valid session.
  if (!ready) {
    return (
      <div className="flex min-h-[420px] flex-1 items-center justify-center lg:min-h-[600px]">
        <LoaderCircle className="size-6 animate-spin text-royal-600" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {step === "email" && (
        <div className="flex justify-center pt-8 lg:hidden">
          <img src="/logo.png" alt="MiDukandar - Smart Business" className="h-11 w-auto object-contain" />
        </div>
      )}

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8 sm:px-10">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-royal-100 bg-royal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-royal-700">
          <span className="size-1.5 rounded-full bg-royal-600" />
          Sign in
        </span>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-navy-950 lg:text-[2rem]">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Sign in to manage your shop and keep your business moving.
        </p>

        {step === "email" ? (
          <form className="mt-7 space-y-5" onSubmit={submitEmail} noValidate>
            <div>
              <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email address
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldError(null);
                    setNotice(null);
                  }}
                  placeholder="owner@midukandar.demo"
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={fieldError ? "login-email-error" : undefined}
                  className={`h-[54px] w-full rounded-xl border bg-white pl-11 pr-4 text-[15px] font-medium text-navy-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:ring-4 ${
                    fieldError
                      ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
                      : "border-slate-200 focus:border-royal-500 focus:ring-royal-500/15"
                  }`}
                />
              </div>
              {fieldError && (
                <p id="login-email-error" role="alert" className="auth-soft-in mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertCircle className="size-3.5" aria-hidden />
                  {fieldError}
                </p>
              )}
            </div>

            <div aria-live="polite" className="space-y-3">
              {notice?.kind === "account-not-found" && (
                <div role="alert" className="auth-soft-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-rose-800">Account not found</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-rose-700">
                        We couldn&apos;t find a MiDukandar account for this email.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {notice?.kind === "network-error" && (
                <div role="alert" className="auth-soft-in flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <WifiOff className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">No connection</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      We couldn&apos;t reach the server. Check your internet connection and try again.
                    </p>
                  </div>
                </div>
              )}

              {notice?.kind === "api-error" && (
                <div role="alert" className="auth-soft-in flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Couldn&apos;t sign in</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-red-700">{notice.message}</p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={sending}
              className="group flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-royal-600 font-display text-[15px] font-bold text-white shadow-[0_10px_24px_-8px_rgb(20_115_230/0.55)] transition-all hover:bg-royal-500 hover:shadow-[0_12px_28px_-8px_rgb(20_115_230/0.6)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-royal-500/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {sending ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              )}
              <span>{sending ? "Checking..." : "Continue"}</span>
            </button>

            <p className="text-center text-sm text-slate-500">
              New to MiDukandar?{" "}
              <Link
                href="/onboard"
                className="font-semibold text-royal-600 transition-colors hover:text-royal-700"
              >
                Register your store
              </Link>
            </p>
          </form>
        ) : step === "password" ? (
          <form className="mt-7 space-y-5" onSubmit={superadminLogin} noValidate>
            <div>
              <label htmlFor="login-password-email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Account
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Mail className="size-[18px] shrink-0 text-slate-400" aria-hidden />
                <span className="truncate text-[15px] font-medium text-navy-900">{email}</span>
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldError(null);
                    setNotice(null);
                  }}
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={fieldError ? "login-password-error" : undefined}
                  className={`h-[54px] w-full rounded-xl border bg-white pl-11 pr-4 text-[15px] font-medium text-navy-900 outline-none transition-all focus:ring-4 ${
                    fieldError
                      ? "border-red-300 focus:border-red-400 focus:ring-red-500/10"
                      : "border-slate-200 focus:border-royal-500 focus:ring-royal-500/15"
                  }`}
                />
              </div>
              {fieldError && (
                <p id="login-password-error" role="alert" className="auth-soft-in mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertCircle className="size-3.5" aria-hidden />
                  {fieldError}
                </p>
              )}
            </div>

            {notice?.kind === "api-error" && (
              <div role="alert" className="auth-soft-in flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {notice.message}
              </div>
            )}
            {notice?.kind === "network-error" && (
              <div role="alert" className="auth-soft-in flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                {notice.message}
              </div>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="group flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-navy-900 font-display text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgb(15_39_71/0.6)] transition-all hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="size-5" aria-hidden />
              )}
              {verifying ? "Signing you in..." : "Open Platform Console"}
            </button>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={continueWithOtp}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
              >
                Not a platform account? Continue with OTP
              </button>
            </div>
          </form>
        ) : (
          <form
            className="mt-7 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode();
            }}
          >
            {!devHint && (
              <div className="auth-soft-in flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <Check className="size-4 shrink-0 text-emerald-500" aria-hidden />
                <p className="text-sm text-emerald-800">
                  <span className="font-semibold">Login code sent.</span> Check your email for the
                  verification code.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {devHint && (
                <div className="auth-soft-in flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <ShieldCheck className="size-4 shrink-0 text-amber-600" aria-hidden />
                  <p>
                    <span className="font-semibold">Dev mode:</span> master code is{" "}
                    <span className="font-mono font-bold">{devHint}</span>. No email was sent.
                  </p>
                </div>
              )}
              <div className="flex justify-center">
                <OtpInput
                  value={otp}
                  onChange={(v) => {
                    setOtp(v);
                    setNotice(null);
                  }}
                  onComplete={(v) => void verifyCode(v)}
                  disabled={verifying}
                  error={notice?.kind === "api-error"}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                {secondsLeft > 0 ? (
                  <span className="countdown-pulse font-medium text-slate-500">
                    Resend in {secondsLeft}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void requestCode(email)}
                    className="font-semibold text-royal-600 transition-colors hover:text-royal-700"
                  >
                    Resend code
                  </button>
                )}
                <button
                  type="button"
                  onClick={changeEmail}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 transition-colors hover:text-slate-700"
                >
                  <ArrowLeft className="size-3" aria-hidden />
                  Change email
                </button>
              </div>
            </div>

            {notice?.kind === "api-error" && (
              <div role="alert" className="auth-soft-in flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {notice.message}
              </div>
            )}
            {notice?.kind === "network-error" && (
              <div role="alert" className="auth-soft-in flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <WifiOff className="size-4 shrink-0" aria-hidden />
                {notice.message}
              </div>
            )}

            <button
              type="submit"
              disabled={verifying || otp.trim().length < 4}
              className="group flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-royal-600 font-display text-[15px] font-bold text-white shadow-[0_10px_24px_-8px_rgb(20_115_230/0.55)] transition-all hover:bg-royal-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-royal-500/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {verifying ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              )}
              {verifying
                ? "Verifying..."
                : "Verify & Sign In"}
            </button>
          </form>
        )}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 lg:hidden">
          <p className="flex items-center gap-2 text-xs font-semibold text-navy-800">
            <Store className="size-4 text-royal-600" aria-hidden />
            Run your shop. Smarter every day.
          </p>
          <div className="mt-3 space-y-2">
            {mobileFeatures.map((f) => (
              <p key={f.title} className="flex items-center gap-2 text-xs text-slate-600">
                <f.icon className="size-3.5 text-royal-600" aria-hidden />
                {f.title}
              </p>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Trusted by <span className="font-semibold text-navy-700">4,800+</span> shops across
            India.
          </p>
        </div>
      </main>

      <footer className="px-6 py-5">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-royal-600">
          <Link href="/pricing" className="transition-colors hover:text-royal-700">
            Pricing
          </Link>
          <span className="text-slate-200" aria-hidden>&middot;</span>
          <Link href="/pricing#faq" className="transition-colors hover:text-royal-700">
            FAQ
          </Link>
          <span className="text-slate-200" aria-hidden>&middot;</span>
          <Link href="/terms" className="transition-colors hover:text-royal-700">
            Terms of Service
          </Link>
          <span className="text-slate-200" aria-hidden>&middot;</span>
          <a href="mailto:support@midukandar.com" className="transition-colors hover:text-royal-700">
            Support
          </a>
        </div>
        <p className="mt-2.5 text-center text-[10px] leading-relaxed text-slate-400">
          <ShieldCheck className="mr-1 inline size-3 text-emerald-500" />
          Secure sign-in.
          <br />
          &copy; {new Date().getFullYear()} MiDukandar
        </p>
      </footer>
    </div>
  );
}