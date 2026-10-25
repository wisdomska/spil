"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/brand/Avatar";
import { RevealStage } from "@/components/game/RevealStage";
import { revealProps } from "@/components/game/revealProps";
import { ErrorScreen } from "@/components/site/ErrorScreen";
import { api, ClientApiError } from "@/lib/api/client";
import type { TvState } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/**
 * Party Mode: the big screen. Paired by the host with a secret link; it polls the room every 2
 * seconds and shows the lobby, everyone's progress, the reveal and the scores. Nothing on it can
 * be tapped: phones are the controllers.
 */
export function TvApp({ code, token }: { code: string; token: string }) {
  const t = useTranslations("tv");
  const tm = useTranslations("modes");
  const q = useQuery({
    queryKey: ["tv", code, token],
    queryFn: () => api<TvState>("GET", `/rooms/${code}/tv?t=${encodeURIComponent(token)}`),
    refetchInterval: 2000,
    retry: 1,
  });

  if (q.error) {
    const c = q.error instanceof ClientApiError ? q.error.code : "";
    if (c === "TV_NOT_PAIRED" || c === "FEATURE_OFF")
      return (
        <main className="grid min-h-[100dvh] place-items-center px-8 text-center">
          <div className="grid max-w-[640px] gap-4">
            <h1 className="m-0 font-display text-display-l font-extrabold tracking-display">
              {c === "FEATURE_OFF" ? t("offTitle") : t("unpairedTitle")}
            </h1>
            <p className="m-0 text-[22px] leading-[1.4] text-text-muted">
              {c === "FEATURE_OFF" ? t("offBody") : t("unpairedBody")}
            </p>
          </div>
        </main>
      );
    return <ErrorScreen variant="server" onRetry={() => q.refetch()} />;
  }
  const s = q.data;
  if (!s) return <main className="min-h-[100dvh]" aria-busy="true" />;

  const host = s.players.find((p) => p.isHost);
  const reveal = s.room.reveal;
  const revealing =
    s.room.status === "revealed" && reveal && reveal.index < reveal.total && s.results;

  if (revealing)
    return (
      <div className="mx-auto w-full max-w-[760px]" style={{ zoom: 1.35 }}>
        <RevealStage
          {...revealProps(s.room.mode, s.results!)}
          reveal={reveal}
          isHost={false}
          hostName={host?.nickname ?? ""}
          onNext={() => {}}
          onSkip={() => {}}
          display
        />
      </div>
    );

  // Rendered only after the room loads in the browser, so window is there.
  const joinUrl = `${window.location.origin}${s.joinPath}`;
  const done = (id: string) => {
    const p = s.players.find((x) => x.id === id)!;
    return s.room.status === "guessing" ? p.guessesSubmitted : p.answersSubmitted;
  };

  return (
    <main className="mx-auto box-border grid min-h-[100dvh] w-full max-w-[1400px] content-start gap-10 px-12 py-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-3">
          <span className="font-mono text-[22px] leading-none font-medium tracking-[.08em] text-text-muted uppercase">
            {tm("inLobby", { mode: tm(`${s.room.mode}.name`) })}
          </span>
          <h1 className="m-0 font-display text-[72px] leading-[.95] font-extrabold tracking-display">
            {s.room.status === "lobby"
              ? t("lobbyTitle")
              : s.room.status === "answering"
                ? t("answeringTitle")
                : s.room.status === "guessing"
                  ? t("guessingTitle")
                  : s.room.status === "ready"
                    ? t("readyTitle", { host: host?.nickname ?? "" })
                    : t("resultsTitle")}
          </h1>
        </div>
        {s.room.status === "lobby" && (
          <div className="grid justify-items-end gap-2">
            <span className="font-mono text-[22px] leading-none text-text-muted">{t("code")}</span>
            <span className="font-mono text-[120px] leading-none font-semibold tracking-[.12em]">
              {s.room.code}
            </span>
          </div>
        )}
      </header>

      {s.room.status === "lobby" && (
        <p className="m-0 text-[28px] leading-[1.35] text-text-muted">
          {t("join", { url: joinUrl.replace(/^https?:\/\//, "") })}
        </p>
      )}

      {s.room.status === "revealed" && s.results ? (
        <ol className="m-0 grid list-none gap-3 p-0">
          {[...s.results.rows]
            .sort((a, b) => a.rank - b.rank)
            .map((r) => (
              <li
                key={r.playerId}
                className="flex items-center gap-6 rounded-card border border-line bg-surface px-8 py-5"
              >
                <span className="w-16 font-mono text-[36px] leading-none font-semibold text-text-muted">
                  {r.rank}
                </span>
                <Avatar n={r.avatar} size={72} label={r.nickname} />
                <span className="min-w-0 flex-1 truncate font-display text-[44px] leading-none font-extrabold">
                  {r.nickname}
                </span>
                <span className="font-mono text-[48px] leading-none font-semibold tabular-nums">
                  {s.room.mode === "classic" || s.room.mode === "spill_or_skip"
                    ? r.score
                    : r.mindReader}
                </span>
              </li>
            ))}
        </ol>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 p-0">
          {s.players
            .filter((p) => p.status === "active" || p.status === "sat_out")
            .map((p) => {
              const finished = s.room.status !== "lobby" && done(p.id);
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-4 rounded-card border px-5 py-4",
                    finished ? "border-accent bg-accent-soft" : "border-line bg-surface",
                  )}
                >
                  <Avatar n={p.avatar} size={64} label={p.nickname} />
                  <span className="min-w-0 flex-1 truncate font-display text-[30px] leading-none font-bold">
                    {p.nickname}
                  </span>
                  {s.room.status === "answering" && !finished && (
                    <span className="font-mono text-[24px] leading-none text-text-muted tabular-nums">
                      {p.answered}/{s.room.questionCount}
                    </span>
                  )}
                  {finished && (
                    <CheckIcon size={32} aria-label={t("done")} className="text-accent-ink" />
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </main>
  );
}
