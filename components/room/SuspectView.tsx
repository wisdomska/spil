"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ClientApiError } from "@/lib/api/client";
import { roomKey } from "@/lib/room/useRoom";
import type { RoomState } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
};

/**
 * Imposter, the vote: every question with everyone's numbers, then a vote for who had different
 * questions (never yourself). Locking the vote submits.
 */
export function SuspectView({ state, onDone }: Props) {
  const t = useTranslations("guess");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const board = state.board ?? [];
  const name = (id: string) => state.players.find((p) => p.id === id);
  const others = useMemo(
    () =>
      // Scored players only, the same as the server checks (SPIL-15).
      state.players.filter(
        (p) =>
          p.id !== state.me.id &&
          (p.status === "active" || (p.status === "sat_out" && p.answersSubmitted)),
      ),
    [state.players, state.me.id],
  );
  const [pick, setPick] = useState<string | null>(state.mySuspect ?? null);
  const [busy, setBusy] = useState(false);

  const lock = async () => {
    if (busy || !pick) return;
    setBusy(true);
    try {
      await api("PUT", `/rooms/${state.room.code}/suspect`, { targetId: pick });
      await onDone();
    } catch (e) {
      // The room changed under this screen (a player was moved on, the phase moved): refresh
      // it and say so, rather than a generic error on every tap.
      const stale =
        e instanceof ClientApiError && ["INVALID_TARGET", "WRONG_PHASE"].includes(e.code);
      if (stale) void qc.invalidateQueries({ queryKey: roomKey(state.room.code) });
      toast(stale ? tt("roomChanged") : tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <div className="grid gap-2.5">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("suspectKicker")}
        </span>
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {t("suspectTitle")}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("suspectBody")}</p>
      </div>
      <div className="grid gap-3">
        {board.map((row) => (
          <section
            key={row.questionId}
            className="grid gap-2.5 rounded-card border border-line bg-surface p-4"
          >
            <h2 className="m-0 text-[16px] leading-[1.3] font-semibold">{row.text}</h2>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {row.answers.map((a) => {
                const p = name(a.playerId);
                if (!p) return null;
                return (
                  <li
                    key={a.playerId}
                    className="flex items-center gap-1.5 rounded-pill bg-surface-raised py-1 pr-3 pl-1 text-[14px] leading-none font-semibold"
                  >
                    <Avatar n={p.avatar} size={24} decorative />
                    {p.nickname}
                    <span className="font-mono text-text-muted tabular-nums">{a.value}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {/* The vote sits in the bar at the bottom, next to Lock in: players read the answers above
          and pick without scrolling past the whole board (UX audit 2026-11-09). */}
      <div className="sticky bottom-0 z-[5] -mx-5 mt-auto grid gap-3 border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <span id="suspect-pick" className="text-[14px] leading-none font-semibold">
          {t("suspectPick")}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="suspect-pick"
          className="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          {others.map((p) => {
            const on = pick === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPick(p.id)}
                className={cn(
                  "flex min-h-12 shrink-0 items-center gap-2 rounded-pill border-[1.5px] py-1.5 pr-3.5 pl-1.5 text-left active:scale-[.97]",
                  on
                    ? "border-accent bg-accent-soft text-text"
                    : "border-line bg-surface text-text hover:bg-surface-raised",
                )}
              >
                <Avatar n={p.avatar} size={32} decorative />
                <span className="max-w-[9rem] truncate text-[15px] leading-tight font-semibold">
                  {p.nickname}
                </span>
                {on && <CheckIcon size={18} aria-hidden className="shrink-0 text-accent-ink" />}
              </button>
            );
          })}
        </div>
        <Button block softDisabled={!pick} loading={busy} onClick={lock}>
          {t("suspectLock")}
        </Button>
      </div>
    </div>
  );
}
