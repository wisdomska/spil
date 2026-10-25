"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
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
  const board = state.board ?? [];
  const name = (id: string) => state.players.find((p) => p.id === id);
  const others = useMemo(
    () =>
      state.players.filter(
        (p) => p.id !== state.me.id && (p.status === "active" || p.status === "sat_out"),
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
    } catch {
      toast(tt("somethingWrong"), "err");
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
      <div role="radiogroup" aria-label={t("suspectAria")} className="grid gap-2.5 sm:grid-cols-2">
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
                "flex min-h-16 items-center gap-3 rounded-card border-[1.5px] px-3.5 py-2.5 text-left active:scale-[.98]",
                on
                  ? "border-accent bg-accent-soft text-text"
                  : "border-line bg-surface text-text hover:bg-surface-raised",
              )}
            >
              <Avatar n={p.avatar} size={40} decorative />
              <span className="min-w-0 flex-1 truncate font-display text-[19px] leading-none font-bold">
                {p.nickname}
              </span>
              {on && <CheckIcon size={20} aria-hidden className="shrink-0 text-accent-ink" />}
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button block softDisabled={!pick} loading={busy} onClick={lock}>
          {t("suspectLock")}
        </Button>
      </div>
    </div>
  );
}
