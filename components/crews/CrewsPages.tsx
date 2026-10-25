"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { CrewSummary } from "@/lib/api/crews";
import { api, ClientApiError, ensureSession } from "@/lib/api/client";
import { MAX_CREW_NAME } from "@/lib/game";

/** My crews: every crew this device is in. */
export function CrewsList() {
  const t = useTranslations("crews");
  const q = useQuery({
    queryKey: ["crews"],
    queryFn: async () => {
      await ensureSession();
      return api<CrewSummary[]>("GET", "/crews");
    },
  });
  return (
    <main className="mx-auto box-border flex w-full max-w-[640px] flex-1 flex-col gap-6 px-5 pt-6 pb-10">
      <h1 className="m-0 font-display text-display-m leading-[1] font-extrabold tracking-display">
        {t("listTitle")}
      </h1>
      {q.data && q.data.length === 0 && (
        <p className="m-0 text-[16px] leading-[1.5] text-text-muted">{t("listEmpty")}</p>
      )}
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {(q.data ?? []).map((c) => (
          <li key={c.id}>
            <Link
              href={`/crew/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-4 text-text no-underline hover:bg-surface-raised"
            >
              <span className="font-display text-[22px] leading-none font-extrabold">{c.name}</span>
              <span className="font-mono text-[13px] text-text-muted">
                {t("members", { n: c.members })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[13px] leading-[1.45] text-text-muted">{t("deviceNote")}</p>
    </main>
  );
}

/** Join a crew from its invite link: pick the name the crew sees, then join. */
export function JoinCrew({ token }: { token: string }) {
  const t = useTranslations("crews");
  const tt = useTranslations("toast");
  const toast = useToast();
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["crew-invite", token],
    queryFn: () =>
      api<{ name: string; members: number }>("GET", `/crews/invite/${encodeURIComponent(token)}`),
    retry: false,
  });
  if (q.error) return <ErrorScreen variant="notfound" />;
  const join = async () => {
    if (busy || !nickname.trim()) return;
    setBusy(true);
    try {
      await ensureSession();
      const res = await api<{ id: string }>("POST", "/crews/join", {
        token,
        nickname: nickname.trim(),
      });
      router.push(`/crew/${res.id}`);
    } catch (e) {
      const code = e instanceof ClientApiError ? e.code : "";
      toast(
        code === "TEXT_BLOCKED"
          ? tt("textBlocked")
          : code === "ROOM_FULL"
            ? tt("crewFull")
            : tt("somethingWrong"),
        "err",
      );
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto box-border flex w-full max-w-[520px] flex-1 flex-col gap-5 px-5 pt-6 pb-10">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {t("inviteKicker")}
      </span>
      <h1 className="m-0 font-display text-display-m leading-[1] font-extrabold tracking-display">
        {q.data ? q.data.name : t("loading")}
      </h1>
      {q.data && (
        <p className="m-0 text-[16px] text-text-muted">{t("members", { n: q.data.members })}</p>
      )}
      <div className="grid gap-2">
        <label htmlFor="crew-nick" className="text-[15px] leading-none font-semibold">
          {t("nicknameLabel")}
        </label>
        <input
          id="crew-nick"
          value={nickname}
          maxLength={MAX_CREW_NAME}
          onChange={(e) => setNickname(e.target.value)}
          className="box-border h-12 w-full rounded-input border border-line bg-surface-raised px-3.5 text-[16px] text-text outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
      </div>
      <Button softDisabled={!nickname.trim()} loading={busy} onClick={join}>
        {t("joinCta")}
      </Button>
      <p className="m-0 text-[13px] leading-[1.45] text-text-muted">{t("joinNote")}</p>
    </main>
  );
}
