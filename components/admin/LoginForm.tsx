"use client";

import { ShieldCheckIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ClientApiError } from "@/lib/api/client";
import { AuthCard, AuthTitle } from "./AuthCard";
import { ErrorLine, FieldRow, Input } from "./fields";

// The email typed on one card is carried to the other in this tab only (never in the URL).
const EMAIL_KEY = "spil-admin-email";
export function rememberEmail(email: string) {
  try {
    if (email) sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    // storage blocked: the field just starts empty
  }
}
export function recallEmail() {
  try {
    return sessionStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Admin sign-in (POST /api/v1/admin/login sets the session cookie). */
export function LoginForm() {
  const t = useTranslations("admin");
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    const remembered = recallEmail();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from this tab
    if (remembered) setEmail(remembered);
    if (params.get("reset") === "done") toast(t("reset.done"));
  }, [params, t, toast]);

  const submit = async () => {
    if (!email.trim() || !password) return setError(t("login.wrong"));
    setBusy(true);
    setError(null);
    try {
      await api("POST", "/admin/login", { email: email.trim(), password });
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      const code = e instanceof ClientApiError ? e.code : "";
      setError(
        code === "RATE_LIMITED"
          ? t("login.rateLimited")
          : code === "INVALID_CREDENTIALS" || code === "BAD_REQUEST"
            ? t("login.wrong")
            : t("common.somethingWrong"),
      );
      setBusy(false);
    }
  };

  return (
    <AuthCard>
      <form
        noValidate
        className="grid gap-[18px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) submit();
        }}
      >
        <span className="flex items-center gap-2.5">
          <Wordmark size={30} />
          <span className="rounded-pill border border-line px-2.5 py-1.5 font-mono text-[13px] leading-none font-medium text-text-muted">
            {t("badge")}
          </span>
        </span>
        <AuthTitle>{t("login.title")}</AuthTitle>
        <FieldRow id="ad-mail" label={t("login.email")}>
          <Input
            id="ad-mail"
            type="email"
            autoComplete="username"
            value={email}
            aria-invalid={!!error || undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
        </FieldRow>
        <FieldRow id="ad-pw" label={t("login.password")}>
          <Input
            id="ad-pw"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={!!error || undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
        </FieldRow>
        <ErrorLine>{error}</ErrorLine>
        <Link
          href="/admin/reset"
          onClick={() => rememberEmail(email.trim())}
          className="-mt-2 -ml-3 inline-flex h-12 items-center justify-self-start rounded-pill px-3 text-[14px] leading-none font-semibold text-accent-ink no-underline hover:bg-surface-raised hover:text-accent-ink"
        >
          {t("login.forgot")}
        </Link>
        <Button type="submit" size="md" block loading={busy}>
          {t("login.submit")}
        </Button>
        <span className="flex items-center gap-2 text-[13px] leading-[1.4] text-text-muted">
          <ShieldCheckIcon aria-hidden size={16} className="shrink-0" />
          {t("login.auditNote")}
        </span>
      </form>
    </AuthCard>
  );
}
