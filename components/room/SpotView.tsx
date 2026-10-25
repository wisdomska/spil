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
import { SkipToReveal } from "./SkipToReveal";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
  onSkip: () => void;
  skipping: boolean;
};

/** Two Truths and a Spill: spot the spill on each other player's card, one card at a time. */
export function SpotView({ state, onDone, onSkip, skipping }: Props) {
  const t = useTranslations("guess");
  const tq = useTranslations("question");
  const tt = useTranslations("toast");
  const toast = useToast();
  const cards = useMemo(
    () => (state.cards ?? []).filter((c) => c.playerId !== state.me.id),
    [state.cards, state.me.id],
  );
  const [spots, setSpots] = useState<Record<string, string>>(() => ({ ...(state.mySpots ?? {}) }));
  const [ci, setCi] = useState(() =>
    Math.max(
      0,
      cards.findIndex((c) => !(c.playerId in spots)),
    ),
  );
  const card = cards[Math.min(ci, cards.length - 1)];
  const [pick, setPick] = useState<string | null>(card ? (spots[card.playerId] ?? null) : null);
  const [busy, setBusy] = useState(false);

  if (!card)
    return (
      <div className="flex flex-1 flex-col gap-[18px]">
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {t("noCardsTitle")}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("noCardsBody")}</p>
        <div className="mt-auto">
          <SkipToReveal state={state} onSkip={onSkip} skipping={skipping} />
        </div>
      </div>
    );
  const owner = state.players.find((p) => p.id === card.playerId);

  const lock = async () => {
    if (busy || !pick) return;
    setBusy(true);
    const next = { ...spots, [card.playerId]: pick };
    try {
      await api("PUT", `/rooms/${state.room.code}/spots`, {
        spots: Object.entries(next).map(([targetId, questionId]) => ({ targetId, questionId })),
      });
      setSpots(next);
      const open = cards.findIndex((c) => !(c.playerId in next));
      if (open >= 0) {
        setCi(open);
        setPick(null);
      } else await onDone();
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
        {t("spotCount", { n: ci + 1, total: cards.length })}
      </span>
      {owner && <Avatar n={owner.avatar} size={80} label={owner.nickname} />}
      <div className="grid gap-2">
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {t("spotTitle", { name: owner?.nickname ?? "" })}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("spotBody")}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={t("spotAria", { name: owner?.nickname ?? "" })}
        className="grid gap-2.5"
      >
        {card.items.map((item) => {
          const on = pick === item.questionId;
          return (
            <button
              key={item.questionId}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPick(item.questionId)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-card border-[1.5px] px-4 py-3 text-left text-[17px] leading-[1.3] font-semibold active:scale-[.99]",
                on
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:bg-surface-raised",
              )}
            >
              <span className="min-w-0 flex-1">
                {tq("haveYouEver")} {item.text}
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
