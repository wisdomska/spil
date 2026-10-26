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
import { SkipToReveal } from "./SkipToReveal";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
  onSkip: () => void;
  skipping: boolean;
};

/** Who Said That?: guess who wrote each of the others' answers, one answer at a time. */
export function WhoView({ state, onDone, onSkip, skipping }: Props) {
  const t = useTranslations("guess");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const items = useMemo(
    () => (state.toGuess ?? []).flatMap((q) => q.answers.map((a) => ({ ...a, prompt: q.text }))),
    [state.toGuess],
  );
  const others = useMemo(
    () =>
      // The possible authors: scored players only, the same as the server checks (SPIL-15).
      state.players.filter(
        (p) =>
          p.id !== state.me.id &&
          (p.status === "active" || (p.status === "sat_out" && p.answersSubmitted)),
      ),
    [state.players, state.me.id],
  );
  const [whose, setWhose] = useState<Record<string, string>>(() => ({ ...(state.myWhose ?? {}) }));
  const [ai, setAi] = useState(() =>
    Math.max(
      0,
      items.findIndex((a) => !(a.id in whose)),
    ),
  );
  const item = items[Math.min(ai, items.length - 1)];
  const [pick, setPick] = useState<string | null>(item ? (whose[item.id] ?? null) : null);
  const [busy, setBusy] = useState(false);

  if (!item)
    return (
      <div className="flex flex-1 flex-col gap-[18px]">
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {t("whoNoneTitle")}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("whoNoneBody")}</p>
        <div className="mt-auto">
          <SkipToReveal state={state} onSkip={onSkip} skipping={skipping} />
        </div>
      </div>
    );

  const lock = async () => {
    if (busy || !pick) return;
    setBusy(true);
    const next = { ...whose, [item.id]: pick };
    try {
      await api("PUT", `/rooms/${state.room.code}/whose`, {
        guesses: Object.entries(next).map(([answerId, authorId]) => ({ answerId, authorId })),
      });
      setWhose(next);
      const open = items.findIndex((a) => !(a.id in next));
      if (open >= 0) {
        setAi(open);
        setPick(next[items[open]!.id] ?? null);
      } else await onDone();
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
      <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
        {t("whoCount", { n: ai + 1, total: items.length })}
      </span>
      <div className="grid gap-2.5">
        <span className="text-[15px] leading-[1.35] font-semibold text-text-muted">
          {item.prompt}
        </span>
        <blockquote className="m-0 rounded-card border border-line bg-surface-raised px-5 py-4 font-display text-[24px] leading-[1.2] font-extrabold tracking-[-.01em] text-balance">
          {item.body}
        </blockquote>
      </div>
      <div role="radiogroup" aria-label={t("whoAria")} className="grid gap-2.5 sm:grid-cols-2">
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
          {t("lock")}
        </Button>
      </div>
    </div>
  );
}
