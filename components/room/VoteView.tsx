"use client";

import { ArrowLeftIcon, CheckIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { PourProgress } from "@/components/brand/PourProgress";
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
 * Most Likely To: for each prompt, pick the player in the room most likely to do it. Votes are
 * secret and never yourself. Saved as soon as you pick; locking the last one submits.
 */
export function VoteView({ state, onDone }: Props) {
  const t = useTranslations("question");
  const tg = useTranslations("guess");
  const tt = useTranslations("toast");
  const toast = useToast();
  const questions = state.questions ?? [];
  const total = questions.length;
  // Anyone still in the game except me, in roster order.
  const candidates = useMemo(
    () => state.players.filter((p) => p.id !== state.me.id && p.status === "active"),
    [state.players, state.me.id],
  );
  const [votes, setVotes] = useState<Record<string, string>>(() => ({ ...(state.myVotes ?? {}) }));
  const [qi, setQi] = useState(() =>
    Math.max(
      0,
      questions.findIndex((q) => !(q.id in votes)),
    ),
  );
  const q = questions[Math.min(qi, total - 1)];
  const [pick, setPick] = useState<string | null>(q ? (votes[q.id] ?? null) : null);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced save of the current pick (spec section 8: 400 ms).
  useEffect(() => {
    if (!q || !pick) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("PUT", `/rooms/${state.room.code}/votes`, {
        votes: [{ questionId: q.id, targetId: pick }],
      }).catch(() => {
        // retried on lock
      });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [pick, q, state.room.code]);

  if (!q) return null;

  const goTo = (i: number, from: Record<string, string>) => {
    setQi(i);
    const id = questions[i]?.id;
    setPick(id ? (from[id] ?? null) : null);
  };

  const lock = async () => {
    if (busy || !pick) return;
    setBusy(true);
    clearTimeout(saveTimer.current);
    const next = { ...votes, [q.id]: pick };
    try {
      await api("PUT", `/rooms/${state.room.code}/votes`, {
        votes: Object.entries(next).map(([questionId, targetId]) => ({ questionId, targetId })),
      });
      setVotes(next);
      const open = questions.findIndex((x) => !(x.id in next));
      if (open >= 0) goTo(open, next);
      else await onDone();
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  const done = Object.keys(votes).filter((id) => questions.some((x) => x.id === id)).length;

  return (
    <div className="flex flex-1 flex-col gap-[18px] xl:mx-auto xl:w-full xl:max-w-[720px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("previousPrompt")}
          onClick={() => qi > 0 && goTo(qi - 1, votes)}
          className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
        >
          <ArrowLeftIcon aria-hidden />
        </button>
        <PourProgress value={Math.min(done, total)} total={total} label={t("progress")} />
        <span className="min-w-12 text-right font-mono text-[14px] leading-none font-medium tabular-nums">
          {qi + 1}/{total}
        </span>
      </div>
      <div className="grid gap-2.5">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted uppercase">
          {t("voteAsk")}
        </span>
        <h1 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
          {q.text}
        </h1>
        <p className="m-0 text-[14px] leading-[1.4] text-text-muted">{t("voteHint")}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={t("voteAria", { n: qi + 1, total, text: q.text })}
        className="grid gap-2.5 sm:grid-cols-2"
      >
        {candidates.map((p) => {
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
          {tg("lock")}
        </Button>
      </div>
    </div>
  );
}
