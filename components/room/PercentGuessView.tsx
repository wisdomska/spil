"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { GuessVessel } from "@/components/game/GuessVessel";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { haptic } from "@/lib/haptics";
import type { RoomState } from "@/lib/api/types";
import { SkipToReveal } from "./SkipToReveal";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
  onSkip: () => void;
  skipping: boolean;
  /** Hot Takes: guess the room's average rating instead of the share who said yes. */
  average?: boolean;
  /** Dev fixtures only: a starting guess (otherwise there is none until the first touch). */
  initialValue?: number | null;
};

/**
 * Room Percentage: guess what share of the room said yes, one question at a time. Saved
 * debounced; the last lock submits. Only questions 3 or more people answered are asked.
 */
export function PercentGuessView({
  state,
  onDone,
  onSkip,
  skipping,
  average = false,
  initialValue = null,
}: Props) {
  const t = useTranslations("guess");
  const tq = useTranslations("question");
  const tt = useTranslations("toast");
  const c = useTranslations("common");
  const toast = useToast();
  // The server decides which questions can be guessed.
  const questions = useMemo(
    () => (state.percentQuestions ?? []).filter((q) => state.me.targets.includes(q.id)),
    [state.percentQuestions, state.me.targets],
  );
  const [locked, setLocked] = useState<Record<string, number>>(() => ({
    ...(state.myPercent ?? {}),
  }));
  const [qi, setQi] = useState(() =>
    Math.max(
      0,
      questions.findIndex((q) => !(q.id in locked)),
    ),
  );
  // SPIL-10: no value until the player touches the vessel, so nobody anchors on 50.
  const [value, setValue] = useState<number | null>(initialValue);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const question = questions[qi % Math.max(1, questions.length)];

  // Debounced save of the current guess (spec section 8: 400 ms).
  useEffect(() => {
    if (!question || value === null) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("PUT", `/rooms/${state.room.code}/percent`, {
        guesses: [{ questionId: question.id, value }],
      }).catch(() => {
        // retried on lock
      });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [value, question, state.room.code]);

  if (!question)
    return (
      <div className="flex flex-1 flex-col gap-[18px]">
        <span className="font-mono text-[13px] leading-none font-medium text-text-muted">
          {t("nothingKicker")}
        </span>
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {average ? t("avgNothingTitle") : t("percentNothingTitle")}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">
          {average ? t("avgNothingBody") : t("percentNothingBody")}
        </p>
        <span className="flex items-center gap-1.5 text-[14px] leading-none font-semibold text-text">
          <CheckIcon size={16} aria-hidden />
          {c("lockedIn")}
        </span>
        <div className="mt-auto">
          <SkipToReveal state={state} onSkip={onSkip} skipping={skipping} />
        </div>
      </div>
    );

  const lock = async () => {
    if (busy || value === null) return;
    setBusy(true);
    clearTimeout(saveTimer.current);
    const next = { ...locked, [question.id]: value };
    try {
      await api("PUT", `/rooms/${state.room.code}/percent`, {
        guesses: Object.entries(next).map(([questionId, v]) => ({ questionId, value: v })),
      });
      setLocked(next);
      haptic(10);
      const open = questions.findIndex((q) => !(q.id in next));
      if (open >= 0) {
        setQi(open);
        setValue(null);
      } else {
        await onDone();
      }
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Wide screens: the question on the left, the vessel and Lock it in on the right.
    <div className="flex flex-1 flex-col gap-[18px] xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center xl:gap-14">
      <div className="contents xl:flex xl:flex-col xl:gap-5">
        <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
          {t(average ? "avgCount" : "percentCount", {
            n: (qi % questions.length) + 1,
            total: questions.length,
          })}
        </span>
        <div className="grid gap-2.5">
          <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted uppercase">
            {average ? t("avgAsk") : t("percentAsk")}
          </span>
          <h1 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance xl:text-[44px]">
            {question.text}
          </h1>
        </div>
      </div>
      <div className="contents xl:flex xl:flex-col xl:gap-4">
        <GuessVessel
          key={question.id}
          value={value}
          onChange={setValue}
          showLabel={false}
          unit={average ? "" : "%"}
          label={t(average ? "avgAria" : "percentAria", { question: question.text })}
          valueText={(v) => t(average ? "avgValueText" : "percentValueText", { value: v })}
          emptyText={t("noGuess")}
          hint={t("drag")}
          lowerLabel={t("lower")}
          raiseLabel={t("raise")}
          lowCaption={average ? tq("rateLow") : t("nobody")}
          highCaption={average ? tq("rateHigh") : t("everyone")}
        />
        {/* The vessel is tall on phones, so Lock it in stays on screen (and dragging never scrolls). */}
        <div className="sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <Button block softDisabled={value === null} loading={busy} onClick={lock}>
            {t("lock")}
          </Button>
        </div>
      </div>
    </div>
  );
}
