"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";

export default function InviteAcceptClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const token = searchParams.get("token") ?? "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = token.trim().length < 20;

  const submit = async () => {
    if (password.length < 6) {
      toast.error(t("inviteAcceptPasswordTooShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("inviteAcceptPasswordMismatch"));
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/users/invite/accept", {
        method: "POST",
        noAuth: true,
        body: {
          token: token.trim(),
          name: name.trim() || undefined,
          password,
        },
      });
      setDone(true);
      toast.success(t("inviteAcceptSuccess"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("inviteAcceptMissingToken");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-[0_16px_48px_-12px_rgb(15_39_71/0.14)]">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-royal-100 text-royal-700">
          {done ? <CheckCircle2 className="size-6" /> : <ShieldCheck className="size-6" />}
        </div>
        <h1 className="text-xl font-semibold text-navy-900">{t("inviteAcceptTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("inviteAcceptSubtitle")}</p>
      </div>

      {invalidLink && !done ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{t("inviteAcceptMissingToken")}</span>
        </div>
      ) : done ? (
        <Button className="w-full" onClick={() => router.replace("/login")}>
          {t("inviteAcceptGoToLogin")}
        </Button>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">{t("inviteAcceptName")}</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-password">{t("inviteAcceptPassword")}</Label>
              <Input
                id="invite-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-confirm">{t("inviteAcceptConfirmPassword")}</Label>
              <Input
                id="invite-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? t("inviteAccepting") : t("inviteAcceptSubmit")}
          </Button>
        </form>
      )}

      {!done ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-sm text-royal-700 underline-offset-4 hover:underline"
            onClick={() => router.replace("/login")}
          >
            {t("inviteAcceptGoToLogin")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
