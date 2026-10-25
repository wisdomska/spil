"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { CrewDetail } from "@/lib/api/crews";
import { api, ensureSession } from "@/lib/api/client";
import { seasonKey } from "@/lib/game";

function shiftSeason(season: string, by: number) {
  const [y, m] = season.split("-").map(Number) as [number, number];
  return seasonKey(Date.UTC(y, m - 1 + by, 1));
}

/** A crew's page: the season table, recent rounds, members and the invite link. Members only. */
export function CrewPage({ id }: { id: string }) {
  const t = useTranslations("crews");
  const tm = useTranslations("modes");
  const tt = useTranslations("toast");
  const toast = useToast();
  const router = useRouter();
  const [season, setSeason] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const q = useQuery({
    queryKey: ["crew", id, season],
    queryFn: async () => {
      await ensureSession();
      return api<CrewDetail>("GET", `/crews/${id}${season ? `?season=${season}` : ""}`);
    },
  });
  if (q.error) return <ErrorScreen variant="notfound" />;
  const c = q.data;
  if (!c) return <main className="min-h-[60dvh]" aria-busy="true" />;
  const monthName = (s: string) =>
    new Date(`${s}-01T00:00:00Z`).toLocaleDateString("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/crew/join/${c.inviteToken}`);
      toast(tt("crewLinkCopied"));
    } catch {
      toast(tt("somethingWrong"), "err");
    }
  };
  const leave = async () => {
    try {
      await api("POST", `/crews/${id}/leave`);
      toast(tt("crewLeft", { name: c.name }));
      router.replace("/crews");
    } catch {
      toast(tt("somethingWrong"), "err");
    }
  };

  return (
    <main className="mx-auto box-border flex w-full max-w-[640px] flex-1 flex-col gap-7 px-5 pt-6 pb-10">
      <div className="grid gap-2">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("kicker")}
        </span>
        <h1 className="m-0 font-display text-display-m leading-[1] font-extrabold tracking-display">
          {c.name}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Link
          href={`/create?crew=${c.id}`}
          className="flex h-14 flex-[1_1_200px] items-center justify-center rounded-pill bg-accent px-6 text-[17px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent"
        >
          {t("startGame")}
        </Link>
        <Button variant="secondary" className="flex-[1_1_200px]" onClick={copy}>
          {t("copyInvite")}
        </Button>
      </div>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 font-display text-[26px] leading-none font-extrabold">
            {t("season", { month: monthName(c.season) })}
          </h2>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label={t("previousSeason")}
              onClick={() => setSeason(shiftSeason(c.season, -1))}
              className="h-11 rounded-pill border border-line bg-transparent px-3.5 text-[14px] font-semibold text-text hover:bg-surface-raised"
            >
              {t("previous")}
            </button>
            <button
              type="button"
              aria-label={t("nextSeason")}
              disabled={c.season >= c.currentSeason}
              onClick={() => setSeason(shiftSeason(c.season, 1))}
              className="h-11 rounded-pill border border-line bg-transparent px-3.5 text-[14px] font-semibold text-text hover:bg-surface-raised disabled:opacity-40"
            >
              {t("next")}
            </button>
          </div>
        </div>
        {c.table.length === 0 ? (
          <p className="m-0 text-[15px] leading-[1.45] text-text-muted">{t("seasonEmpty")}</p>
        ) : (
          <ol className="m-0 grid list-none gap-2 p-0">
            {c.table.map((r) => (
              <li
                key={r.userId}
                className="flex items-center gap-4 rounded-card border border-line bg-surface px-4 py-3"
              >
                <span className="w-7 font-mono text-[16px] leading-none font-semibold text-text-muted">
                  {r.place}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[20px] leading-none font-bold">
                  {r.nickname}
                </span>
                <span className="font-mono text-[13px] leading-none text-text-muted">
                  {t("roundsWins", { rounds: r.rounds, wins: r.wins })}
                </span>
                <span className="font-mono text-[24px] leading-none font-semibold tabular-nums">
                  {r.points}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="m-0 text-[13px] leading-[1.45] text-text-muted">{t("seasonNote")}</p>
      </section>

      <section className="grid gap-3">
        <h2 className="m-0 font-display text-[22px] leading-none font-extrabold">{t("history")}</h2>
        {c.rounds.length === 0 ? (
          <p className="m-0 text-[15px] text-text-muted">{t("historyEmpty")}</p>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {c.rounds.map((r) => (
              <li
                key={`${r.roomCode}-${r.round}`}
                className="flex justify-between gap-3 text-[15px] leading-[1.4]"
              >
                <span>
                  {tm(`${r.mode as "classic"}.name`)} ·{" "}
                  <span className="text-text-muted">
                    {new Date(r.playedAt).toLocaleDateString("en", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </span>
                <span className="font-semibold">
                  {r.winner ? t("won", { name: r.winner }) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="m-0 font-display text-[22px] leading-none font-extrabold">
          {t("members", { n: c.members.length })}
        </h2>
        <p className="m-0 text-[15px] leading-[1.6]">
          {c.members.map((m) => (m.you ? t("you", { name: m.nickname }) : m.nickname)).join(", ")}
        </p>
      </section>

      <button
        type="button"
        onClick={() => setLeaving(true)}
        className="w-fit border-0 bg-transparent p-0 text-[14px] font-semibold text-text-muted underline underline-offset-4 hover:text-text"
      >
        {t("leave")}
      </button>
      <Sheet
        open={leaving}
        onOpenChange={setLeaving}
        title={t("leaveTitle", { name: c.name })}
        description={t("leaveBody")}
      >
        <Button variant="destructive" onClick={leave}>
          {t("leaveCta")}
        </Button>
        <Button variant="secondary" onClick={() => setLeaving(false)}>
          {t("stay")}
        </Button>
      </Sheet>
    </main>
  );
}
