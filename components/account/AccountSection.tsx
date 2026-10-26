"use client";

import { CloudCheckIcon, UserCircleCheckIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PasswordField } from "@/components/account/PasswordField";
import { RecoveryCode } from "@/components/account/RecoveryCode";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useTurnstile } from "@/components/ui/Turnstile";
import { clearAccount, saveAccount } from "@/lib/account/device";
import { useAccountsReady } from "@/lib/account/ready";
import { passwordProblem, usernameProblem } from "@/lib/account/rules";
import { api, ClientApiError, ensureSession } from "@/lib/api/client";

type AccountState = { account: { username: string } | null };

/** A guest without a session yet has no account; any other failure is a real error. */
async function loadAccount(): Promise<AccountState> {
  try {
    return await api<AccountState>("GET", "/account");
  } catch (e) {
    if (e instanceof ClientApiError && e.code === "UNAUTHENTICATED") return { account: null };
    throw e;
  }
}

/**
 * Profile settings, account part (owner decision 2026-10-26): a guest can save their progress
 * with a username and password (no email; a one-time recovery code instead). Signed in, they can
 * sign out or delete the account. Never required to play.
 */
export function AccountSection() {
  const t = useTranslations("account");
  const qc = useQueryClient();
  const ready = useAccountsReady();
  const q = useQuery({ queryKey: ["account"], queryFn: loadAccount, enabled: ready });
  const [code, setCode] = useState<string | null>(null);

  // The server is the truth for the header menu's signed-in state on this phone.
  const username = q.data?.account?.username ?? null;
  useEffect(() => {
    if (!q.isSuccess) return;
    if (username) saveAccount(username);
    else clearAccount();
  }, [q.isSuccess, username]);

  // Accounts are not switched on in this database yet.
  if (!ready) return null;
  if (!q.data) return <Skeleton className="h-[180px] rounded-card" />;
  if (code)
    return (
      <RecoveryCode
        code={code}
        onDone={() => {
          setCode(null);
          void qc.invalidateQueries({ queryKey: ["account"] });
        }}
      />
    );
  if (username) return <SignedIn username={username} />;
  return (
    <SaveProgress
      onSaved={(name, recoveryCode) => {
        saveAccount(name);
        qc.setQueryData<AccountState>(["account"], { account: { username: name } });
        setCode(recoveryCode);
      }}
      title={t("title")}
    />
  );
}

function SaveProgress({
  onSaved,
  title,
}: {
  onSaved: (username: string, recoveryCode: string) => void;
  title: string;
}) {
  const t = useTranslations("account");
  const tt = useTranslations("toast");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userErr, setUserErr] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { getToken, element, challenge, showChallenge } = useTurnstile();

  const submit = async () => {
    if (busy) return;
    const u = usernameProblem(username);
    const p = passwordProblem(password, username);
    setUserErr(u && t(`errors.${u}`));
    setPassErr(p && t(`errors.${p}`));
    if (u || p) return;
    setBusy(true);
    try {
      await ensureSession();
      const captchaToken = await getToken();
      if (captchaToken === undefined) {
        showChallenge();
        toast(tt("botCheck"), "err");
        return;
      }
      const res = await api<{ account: { username: string }; recoveryCode: string }>(
        "POST",
        "/account",
        { username: username.trim(), password, captchaToken: captchaToken || undefined },
      );
      onSaved(res.account.username, res.recoveryCode);
    } catch (e) {
      const c = e instanceof ClientApiError ? e.code : "";
      if (c === "USERNAME_TAKEN") setUserErr(t("errors.taken"));
      else if (c === "USERNAME_INVALID") setUserErr(t("errors.blocked"));
      else if (c === "PASSWORD_WEAK") setPassErr(t("errors.common"));
      else if (c === "ACCOUNT_EXISTS") toast(t("errors.exists"), "err");
      else if (c === "CAPTCHA_FAILED") {
        showChallenge();
        toast(tt("botCheck"), "err");
      } else if (c === "RATE_LIMITED") toast(tt("rateLimited"), "err");
      else toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="account"
      aria-labelledby="account-title"
      className="grid scroll-mt-24 gap-4 rounded-card border border-line bg-surface p-5"
    >
      <h2
        id="account-title"
        className="m-0 flex items-center gap-2.5 font-display text-[24px] leading-none font-extrabold tracking-[-.02em]"
      >
        <CloudCheckIcon aria-hidden size={26} weight="bold" className="text-accent-ink" />
        {title}
      </h2>
      <p className="m-0 text-[15px] leading-[1.45] text-pretty text-text-muted">{t("body")}</p>
      {open ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <TextField
            id="account-username"
            label={t("username")}
            help={t("usernameHelp")}
            error={userErr ?? undefined}
            value={username}
            maxLength={20}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => {
              setUsername(e.target.value);
              setUserErr(null);
            }}
          />
          <PasswordField
            id="account-password"
            label={t("password")}
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
            {t("create")}
          </Button>
        </form>
      ) : (
        <div className="grid gap-2.5">
          <Button block onClick={() => setOpen(true)}>
            {t("start")}
          </Button>
        </div>
      )}
      <Link
        href="/sign-in"
        className="w-fit text-[15px] leading-[1.4] font-semibold text-text-muted underline underline-offset-4 hover:text-text"
      >
        {t("haveAccount")}
      </Link>
      {element}
    </section>
  );
}

function SignedIn({ username }: { username: string }) {
  const t = useTranslations("account");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedErr, setTypedErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"out" | "delete" | null>(null);

  const done = (message: string) => {
    clearAccount();
    qc.setQueryData<AccountState>(["account"], { account: null });
    toast(message);
  };

  const signOut = async () => {
    setBusy("out");
    try {
      await api("POST", "/account/sign-out");
      done(t("signedOut"));
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (typed.trim().toLowerCase() !== username.toLowerCase())
      return setTypedErr(t("errors.confirm"));
    setBusy("delete");
    try {
      await api("DELETE", "/account", { username: typed.trim() });
      setConfirming(false);
      done(t("deleted"));
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      id="account"
      aria-labelledby="account-title"
      className="grid scroll-mt-24 gap-4 rounded-card border border-line bg-surface p-5"
    >
      <h2
        id="account-title"
        className="m-0 flex items-center gap-2.5 font-display text-[24px] leading-[1.1] font-extrabold tracking-[-.02em] [overflow-wrap:anywhere]"
      >
        <UserCircleCheckIcon
          aria-hidden
          size={26}
          weight="bold"
          className="shrink-0 text-success"
        />
        {t("signedIn", { username })}
      </h2>
      <p className="m-0 text-[15px] leading-[1.45] text-pretty text-text-muted">
        {t("signedInBody")}
      </p>
      <Button variant="secondary" block loading={busy === "out"} onClick={signOut}>
        {t("signOut")}
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-12 border-0 bg-transparent text-[15px] leading-none font-semibold text-error underline underline-offset-4 hover:text-text"
      >
        {t("delete")}
      </button>
      <Sheet open={confirming} onOpenChange={setConfirming} title={t("deleteTitle")}>
        <p className="m-0 text-[15px] leading-[1.45] text-pretty text-text-muted">
          {t("deleteBody")}
        </p>
        <TextField
          id="account-delete-confirm"
          label={t("deleteConfirm", { username })}
          error={typedErr ?? undefined}
          value={typed}
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => {
            setTyped(e.target.value);
            setTypedErr(null);
          }}
        />
        <Button variant="destructive" block loading={busy === "delete"} onClick={remove}>
          {t("deleteYes")}
        </Button>
        <Button variant="secondary" block onClick={() => setConfirming(false)}>
          {t("deleteKeep")}
        </Button>
      </Sheet>
    </section>
  );
}
