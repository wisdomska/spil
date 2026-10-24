"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { GuessVessel } from "@/components/game/GuessVessel";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";
import { SkipToReveal } from "./SkipToReveal";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
  onSkip: () => void;
  skipping: boolean;
  /** Dev fixtures only: a starting guess (otherwise there is none until the first touch). */
  initialValue?: number | null;
};

/** Guess each other player's score, one at a time. Saved debounced; the last lock submits. */
export function GuessView({ state, onDone, onSkip, skipping, initialValue = null }: Props) {
  const t = useTranslations("guess");
  const tt = useTranslations("toast");
  const c = useTranslations("common");
  const toast = useToast();
  // The server decides who each player guesses about.
  const targets = useMemo(
    () => state.players.filter((p) => state.me.targets.includes(p.id)),
    [state.players, state.me.targets],
  );
  const [locked, setLocked] = useState<Record<string, number>>(() => ({
    ...(state.myGuesses ?? {}),
  }));
  const firstOpen = () =>
    Math.max(
      0,
      targets.findIndex((p) => !(p.id in locked)),
    );
  const [gi, setGi] = useState(firstOpen);
  // SPIL-10: no value until the player touches the vessel, so nobody anchors on 50.
  const [value, setValue] = useState<number | null>(initialValue);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const target = targets[gi % Math.max(1, targets.length)];

  // Debounced save of the current guess (spec section 8: 400 ms).
  useEffect(() => {
    if (!target || value === null) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("PUT", `/rooms/${state.room.code}/guesses`, {
        guesses: [{ targetId: target.id, value }],
      }).catch(() => {
        // retried on lock
      });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [value, target, state.room.code]);

  if (!target)
    return (
      <div className="flex flex-1 flex-col gap-[18px]">
        <span className="font-mono text-[13px] leading-none font-medium text-text-muted">
          {t("nothingKicker")}
        </span>
        <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
          {t("nothingTitle")}
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-text-muted">{t("nothingBody")}</p>
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
    const next = { ...locked, [target.id]: value };
    try {
      await api("PUT", `/rooms/${state.room.code}/guesses`, {
        guesses: Object.entries(next).map(([targetId, v]) => ({ targetId, value: v })),
      });
      setLocked(next);
      const open = targets.findIndex((p) => !(p.id in next));
      if (open >= 0) {
        setGi(open);
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
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
        {t("count", { n: (gi % targets.length) + 1, total: targets.length })}
      </span>
      <Avatar n={target.avatar} size={104} label={target.nickname} />
      <h1 className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance">
        {t.rich("title", {
          name: target.nickname,
          em: (chunks) => (
            <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
              {chunks}
            </span>
          ),
        })}
      </h1>
      <GuessVessel
        key={target.id}
        value={value}
        onChange={setValue}
        label={t("aria", { name: target.nickname })}
        valueText={(v, label) => t("valueText", { value: v, label })}
        emptyText={t("noGuess")}
        hint={t("drag")}
        lowerLabel={t("lower")}
        raiseLabel={t("raise")}
        lowCaption={t("saint")}
        highCaption={t("menace")}
      />
      {/* The vessel is tall on phones, so Lock it in stays on screen (and dragging never scrolls). */}
      <div className="sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button block softDisabled={value === null} loading={busy} onClick={lock}>
          {t("lock")}
        </Button>
      </div>
    </div>
  );
}
