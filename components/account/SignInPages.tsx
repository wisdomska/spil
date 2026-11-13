"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PasswordField } from "@/components/account/PasswordField";
import { RecoveryCode } from "@/components/account/RecoveryCode";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useTurnstile } from "@/components/ui/Turnstile";
import { saveAccount } from "@/lib/account/device";
import { passwordProblem } from "@/lib/account/rules";
import { api, ClientApiError } from "@/lib/api/client";
import { Checkbox } from "@/components/ui/Checkbox";

type Signed = { account: { username: string } };

/** Shared error handling for sign-in and recovery. Returns the inline message, if any. */
function useAccountErrors() {
  const t = useTranslations("account");
  const tt = useTranslations("toast");
  const toast = useToast();
  return (e: unknown, credentials: "credentials" | "recovery", showChallenge: () => void) => {
    const c = e instanceof ClientApiError ? e.code : "";
    if (c === "INVALID_CREDENTIALS") return t(`errors.${credentials}`);
    if (c === "PASSWORD_WEAK") return t("errors.common");
    if (c === "CAPTCHA_FAILED") showChallenge();
    toast(
      c === "CAPTCHA_FAILED"
        ? tt("botCheck")
        : c === "RATE_LIMITED"
          ? tt("rateLimited")
          : c === "OFFLINE"
            ? tt("offline")
            : tt("somethingWrong"),
      "err",
    );
    return null;
  };
}

function Shell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto box-border flex w-full max-w-[480px] flex-1 flex-col gap-[22px] px-5 pt-4 pb-10">
      <div className="grid gap-2.5">
        <h1 className="m-0 font-display text-[40px] leading-[.96] font-extrabold tracking-display">
          {title}
        </h1>
        <p className="m-0 text-[16px] leading-[1.5] text-pretty text-text-muted">{lede}</p>
      </div>
      {children}
    </main>
  );
}

/**
 * Sign in with username and password. On a phone whose guest has progress, it offers to add
 * that progress to the account (merged on the server).
 */
export function SignInPage() {
  const t = useTranslations("account");
  const tt = useTranslations("toast");
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const onError = useAccountErrors();
  const { getToken, element, challenge, showChallenge } = useTurnstile();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [merge, setMerge] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guest = useQuery({
    queryKey: ["guest-progress"],
    queryFn: () =>
      api<{ progress: boolean }>("GET", "/account/guest").catch(() => ({ progress: false })),
  });

  const submit = async () => {
    if (busy) return;
    // An empty form used to do nothing at all; say what is missing instead.
    if (!username.trim() || !password) return setErr(t("errors.missing"));
    setBusy(true);
    setErr(null);
    try {
      const captchaToken = await getToken();
      if (captchaToken === undefined) {
        showChallenge();
        toast(tt("botCheck"), "err");
        return;
      }
      const res = await api<Signed>("POST", "/account/sign-in", {
        username: username.trim(),
        password,
        mergeGuest: Boolean(guest.data?.progress && merge),
        captchaToken: captchaToken || undefined,
      });
      saveAccount(res.account.username);
      qc.clear();
      toast(t("signedIn", { username: res.account.username }));
      router.push("/profile");
    } catch (e) {
      setErr(onError(e, "credentials", showChallenge));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={t("signInTitle")} lede={t("signInLede")}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField
          id="signin-username"
          label={t("username")}
          value={username}
          maxLength={20}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={err ?? undefined}
          onChange={(e) => {
            setUsername(e.target.value);
            setErr(null);
          }}
        />
        <PasswordField
          id="signin-password"
          label={t("password")}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErr(null);
          }}
          autoComplete="current-password"
        />
        {guest.data?.progress && (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] leading-[1.35] font-semibold">
            <Checkbox checked={merge} onCheckedChange={setMerge} />
            {t("merge")}
          </label>
        )}
        {challenge}
        <Button type="submit" block loading={busy}>
          {t("signIn")}
        </Button>
      </form>
      <div className="grid justify-items-start gap-3">
        <Link
          href="/recover"
          className="inline-flex min-h-11 items-center text-[15px] leading-[1.4] font-semibold text-accent-ink underline underline-offset-4 hover:text-text"
        >
          {t("forgot")}
        </Link>
        <Link
          href="/profile#account"
          className="inline-flex min-h-11 items-center text-[15px] leading-[1.4] font-semibold text-text-muted underline underline-offset-4 hover:text-text"
        >
          {t("noAccount")}
        </Link>
      </div>
      {element}
    </Shell>
  );
}

/** Forgot the password: the recovery code sets a new one and gives a new code. */
export function RecoverPage() {
  const t = useTranslations("account");
  const router = useRouter();
  const qc = useQueryClient();
  const onError = useAccountErrors();
  const { getToken, element, challenge, showChallenge } = useTurnstile();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !username.trim() || !code.trim()) return;
    const p = passwordProblem(password, username);
    if (p) return setPassErr(t(`errors.${p}`));
    setBusy(true);
    setErr(null);
    try {
      const captchaToken = await getToken();
      if (captchaToken === undefined) {
        showChallenge();
        return;
      }
      const res = await api<Signed & { recoveryCode: string }>("POST", "/account/recover", {
        username: username.trim(),
        recoveryCode: code,
        password,
        captchaToken: captchaToken || undefined,
      });
      saveAccount(res.account.username);
      qc.clear();
      setNext(res.recoveryCode);
    } catch (e) {
      setErr(onError(e, "recovery", showChallenge));
    } finally {
      setBusy(false);
    }
  };

  if (next)
    return (
      <Shell title={t("recoverTitle")} lede={t("recoverLede")}>
        <RecoveryCode code={next} onDone={() => router.push("/profile")} />
      </Shell>
    );

  return (
    <Shell title={t("recoverTitle")} lede={t("recoverLede")}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField
          id="recover-username"
          label={t("username")}
          value={username}
          maxLength={20}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => {
            setUsername(e.target.value);
            setErr(null);
          }}
        />
        <TextField
          id="recover-code"
          label={t("recoveryCode")}
          help={t("recoveryHelp")}
          error={err ?? undefined}
          value={code}
          maxLength={40}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono tracking-[.06em]"
          onChange={(e) => {
            setCode(e.target.value);
            setErr(null);
          }}
        />
        <PasswordField
          id="recover-password"
          label={t("newPassword")}
          help={t("passwordHelp")}
          error={passErr}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setPassErr(null);
          }}
          autoComplete="new-password"
        />
        {challenge}
        <Button type="submit" block loading={busy}>
          {t("recover")}
        </Button>
      </form>
      {element}
    </Shell>
  );
}
