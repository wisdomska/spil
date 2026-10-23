"use client";

import { ArrowLeftIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PASSWORD_MIN } from "@/lib/admin/schemas";
import { api, ClientApiError } from "@/lib/api/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { AuthCard, AuthTitle } from "./AuthCard";
import { ErrorLine, FieldRow, Input } from "./fields";
import { recallEmail, rememberEmail } from "./LoginForm";

type Step = "email" | "code" | "link" | "checking";

/**
 * Password reset. Step 1 sends Supabase's recovery email. Step 2 accepts either the 6-digit code
 * (verifyOtp, type recovery) or the default reset link, which lands back here with ?code= (PKCE)
 * or ?token_hash=. Either way the browser gets a recovery session and the new password is set by
 * POST /api/v1/admin/reset, which checks the account is an admin.
 */
export function ResetForm() {
  const t = useTranslations("admin.reset");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>(
    params.get("code") || params.get("token_hash") ? "checking" : "email",
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const remembered = recallEmail();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from this tab
    if (remembered) setEmail(remembered);
    const supabase = getBrowserClient();
    const linkCode = params.get("code");
    const tokenHash = params.get("token_hash");
    const failed = typeof window !== "undefined" && /error_code=|error=/.test(window.location.hash);
    if (failed) {
      setError(t("linkExpired"));
      return;
    }
    if (!linkCode && !tokenHash) return;
    (async () => {
      const { error: err } = linkCode
        ? await supabase.auth.exchangeCodeForSession(linkCode)
        : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "recovery" });
      // Drop the one-time code from the address bar either way.
      router.replace("/admin/reset");
      if (err) {
        setStep("email");
        setError(t("linkExpired"));
      } else setStep("link");
    })();
  }, [params, router, t]);

  const finish = async () => {
    try {
      await api("POST", "/admin/reset", { password: pw });
      rememberEmail(email.trim());
      router.replace("/admin/login?reset=done");
    } catch (e) {
      const c = e instanceof ClientApiError ? e.code : "";
      if (c === "FORBIDDEN") await getBrowserClient().auth.signOut({ scope: "local" });
      setError(
        c === "FORBIDDEN"
          ? t("notAdmin")
          : c === "UNAUTHENTICATED"
            ? t("codeWrong")
            : c === "BAD_REQUEST"
              ? t("tooShort")
              : tc("somethingWrong"),
      );
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    const supabase = getBrowserClient();
    if (step === "email") {
      const mail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(mail)) return setError(t("emailOff"));
      setBusy(true);
      const { error: err } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/admin/reset`,
      });
      setBusy(false);
      // Same answer whether or not the address is an admin; only throttling is reported.
      if (err && err.status === 429) return setError(t("rateLimited"));
      setStep("code");
      return;
    }
    if (step === "code" && !/^\d{6}$/.test(code)) return setError(t("codeWrong"));
    if (pw.length < PASSWORD_MIN) return setError(t("tooShort"));
    if (pw !== pw2) return setError(t("mismatch"));
    setBusy(true);
    if (step === "code") {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "recovery",
      });
      if (err) {
        setBusy(false);
        return setError(t("codeWrong"));
      }
    }
    await finish();
  };

  const passwords = (
    <>
      <FieldRow id="ad-fpw" label={t("newPassword")} hint={t("passwordHint")}>
        <Input
          id="ad-fpw"
          type="password"
          autoComplete="new-password"
          value={pw}
          aria-describedby="ad-fpw-hint"
          onChange={(e) => {
            setPw(e.target.value);
            setError(null);
          }}
        />
      </FieldRow>
      <FieldRow id="ad-fpw2" label={t("confirm")}>
        <Input
          id="ad-fpw2"
          type="password"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => {
            setPw2(e.target.value);
            setError(null);
          }}
        />
      </FieldRow>
    </>
  );

  return (
    <AuthCard>
      <form
        noValidate
        className="grid gap-[18px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && step !== "checking") submit();
        }}
      >
        <AuthTitle>{t("title")}</AuthTitle>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">
          {step === "email" ? t("introEmail") : step === "code" ? t("introCode") : t("introLink")}
        </p>
        {step === "email" && (
          <FieldRow id="ad-fmail" label={t("adminEmail")}>
            <Input
              id="ad-fmail"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </FieldRow>
        )}
        {step === "code" && (
          <>
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-input bg-accent-soft px-3.5 py-3 text-[14px] leading-[1.45] font-medium"
            >
              <EnvelopeSimpleIcon aria-hidden size={18} className="mt-px shrink-0" />
              <span>{t("codeNotice")}</span>
            </div>
            <FieldRow id="ad-fcode" label={t("code")}>
              <Input
                id="ad-fcode"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                className="font-mono tracking-[0.2em]"
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
              />
            </FieldRow>
            {passwords}
          </>
        )}
        {step === "link" && passwords}
        <ErrorLine>{error}</ErrorLine>
        <Button type="submit" size="md" block loading={busy || step === "checking"}>
          {step === "email" ? t("sendCode") : t("setPassword")}
        </Button>
        <Link
          href="/admin/login"
          onClick={() => rememberEmail(email.trim())}
          className="flex h-12 items-center justify-center gap-2 rounded-pill text-[15px] leading-none font-semibold text-text no-underline hover:bg-surface-raised hover:text-text"
        >
          <ArrowLeftIcon aria-hidden size={18} />
          {t("back")}
        </Link>
      </form>
    </AuthCard>
  );
}
