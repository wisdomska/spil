"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PourProgress } from "@/components/brand/PourProgress";
import { GuessVessel } from "@/components/game/GuessVessel";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
  /** Imposter: questions answered 0 to 100, shown to the room later. */
  imposter?: boolean;
  /** Dev fixtures only: a starting rating (otherwise there is none until the first touch). */
  initialValue?: number | null;
};

/**
 * Hot Takes: rate each statement 0 to 100 on the vessel, in private. Saved debounced; locking the
 * last one submits. Going back shows the rating already given.
 */
export function RateView({ state, onDone, imposter = false, initialValue = null }: Props) {
  const t = useTranslations("question");
  const tg = useTranslations("guess");
  const tt = useTranslations("toast");
  const toast = useToast();
  const questions = state.questions ?? [];
  const total = questions.length;
  const [rated, setRated] = useState<Record<string, number>>(() => ({
    ...(state.myRatings ?? {}),
  }));
  const [qi, setQi] = useState(() =>
    Math.max(
      0,
      questions.findIndex((q) => !(q.id in rated)),
    ),
  );
  const q = questions[Math.min(qi, total - 1)];
  // SPIL-10: no value until the player touches the vessel, so nobody anchors on 50.
  const [value, setValue] = useState<number | null>(
    q && q.id in rated ? rated[q.id]! : initialValue,
  );
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced save of the current rating (spec section 8: 400 ms).
  useEffect(() => {
    if (!q || value === null) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("PUT", `/rooms/${state.room.code}/ratings`, {
        ratings: [{ questionId: q.id, value }],
      }).catch(() => {
        // retried on lock
      });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [value, q, state.room.code]);

  if (!q) return null;

  const goTo = (i: number, from: Record<string, number>) => {
    setQi(i);
    const id = questions[i]?.id;
    setValue(id && id in from ? from[id]! : null);
  };

  const lock = async () => {
    if (busy || value === null) return;
    setBusy(true);
    clearTimeout(saveTimer.current);
    const next = { ...rated, [q.id]: value };
    try {
      await api("PUT", `/rooms/${state.room.code}/ratings`, {
        ratings: Object.entries(next).map(([questionId, v]) => ({ questionId, value: v })),
      });
      setRated(next);
      const open = questions.findIndex((x) => !(x.id in next));
      if (open >= 0) goTo(open, next);
      else await onDone();
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  const done = Object.keys(rated).filter((id) => questions.some((x) => x.id === id)).length;

  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("previousStatement")}
          onClick={() => qi > 0 && goTo(qi - 1, rated)}
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
          {imposter ? t("imposterAsk") : t("rateAsk")}
        </span>
        <h1 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
          {q.text}
        </h1>
        {imposter && (
          <p className="m-0 text-[14px] leading-[1.4] text-text-muted">{t("imposterHint")}</p>
        )}
      </div>
      <GuessVessel
        key={q.id}
        value={value}
        onChange={setValue}
        showLabel={false}
        label={t("rateAria", { n: qi + 1, total, text: q.text })}
        valueText={(v) => t("rateValueText", { value: v })}
        emptyText={t("noRating")}
        hint={tg("drag")}
        lowerLabel={t("rateLower")}
        raiseLabel={t("rateRaise")}
        lowCaption={imposter ? t("imposterLow") : t("rateLow")}
        highCaption={imposter ? t("imposterHigh") : t("rateHigh")}
      />
      {/* The vessel is tall on phones, so Lock it in stays on screen (and dragging never scrolls). */}
      <div className="sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button block softDisabled={value === null} loading={busy} onClick={lock}>
          {tg("lock")}
        </Button>
      </div>
    </div>
  );
}
