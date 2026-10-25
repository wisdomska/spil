"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { canMakeCard } from "@/lib/game";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
};

/**
 * Two Truths and a Spill: after answering, pick your card from your own answers: two you said
 * yes to and one you said no to. Only these three are ever shown. Locking the card submits.
 */
export function PickView({ state, onDone }: Props) {
  const t = useTranslations("question");
  const tt = useTranslations("toast");
  const toast = useToast();
  const answers = state.myAnswers ?? {};
  const questions = state.questions ?? [];
  const yes = questions.filter((q) => answers[q.id] === "yes");
  const no = questions.filter((q) => answers[q.id] === "no");
  const [truths, setTruths] = useState<string[]>(() => state.myPick?.truths ?? []);
  const [spill, setSpill] = useState<string | null>(() => state.myPick?.spill || null);
  const [busy, setBusy] = useState(false);
  const ready = truths.length === 2 && spill !== null;

  const finish = async (send: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (send) await api("PUT", `/rooms/${state.room.code}/pick`, { truths, spill });
      await onDone();
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  if (!canMakeCard(answers))
    return (
      <div className="flex flex-1 flex-col gap-[18px]">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("pickKicker")}
        </span>
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {t("noCardTitle")}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("noCardBody")}</p>
        <div className="mt-auto">
          <Button block loading={busy} onClick={() => finish(false)}>
            {t("noCardCta")}
          </Button>
        </div>
      </div>
    );

  const toggle = (id: string) =>
    setTruths((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < 2
          ? [...cur, id]
          : [cur[1]!, id],
    );
  const ROW =
    "flex min-h-14 w-full items-center gap-3 rounded-card border-[1.5px] px-4 py-3 text-left text-[16px] leading-[1.3] font-semibold active:scale-[.99]";

  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <div className="grid gap-2.5">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("pickKicker")}
        </span>
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {t("pickTitle")}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("pickBody")}</p>
      </div>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-2 text-[15px] leading-none font-semibold">{t("pickTruths")}</legend>
        {yes.map((q) => {
          const on = truths.includes(q.id);
          return (
            <button
              key={q.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(q.id)}
              className={cn(
                ROW,
                on
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:bg-surface-raised",
              )}
            >
              <span className="min-w-0 flex-1">
                {t("haveYouEver")} {q.text}
              </span>
              {on && <CheckIcon size={20} aria-hidden className="shrink-0 text-accent-ink" />}
            </button>
          );
        })}
      </fieldset>
      <div role="radiogroup" aria-label={t("pickSpill")} className="grid gap-2">
        <span className="mb-0.5 text-[15px] leading-none font-semibold">{t("pickSpill")}</span>
        {no.map((q) => {
          const on = spill === q.id;
          return (
            <button
              key={q.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSpill(q.id)}
              className={cn(
                ROW,
                on
                  ? "border-text bg-surface-raised"
                  : "border-line bg-surface hover:bg-surface-raised",
              )}
            >
              <span className="min-w-0 flex-1">
                {t("haveYouEver")} {q.text}
              </span>
              {on && <CheckIcon size={20} aria-hidden className="shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className="sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button block softDisabled={!ready} loading={busy} onClick={() => ready && finish(true)}>
          {t("pickLock")}
        </Button>
      </div>
    </div>
  );
}
