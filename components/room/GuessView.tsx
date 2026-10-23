"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { labelStickerStyle, type LabelName } from "@/components/brand/Stickers";
import { Button } from "@/components/ui/Button";
import { ScoreSlider } from "@/components/ui/ScoreSlider";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";
import { labelFor } from "@/lib/game";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
};

/** Guess each other player's score, one at a time. Saved debounced; the last lock submits. */
export function GuessView({ state, onDone }: Props) {
  const t = useTranslations("guess");
  const tt = useTranslations("toast");
  const toast = useToast();
  const targets = useMemo(
    () => state.players.filter((p) => p.id !== state.me.id && p.status === "active"),
    [state.players, state.me.id],
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
  const [value, setValue] = useState(50);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const target = targets[gi % Math.max(1, targets.length)];

  // Debounced save of the current slider value (spec section 8: 400 ms).
  useEffect(() => {
    if (!target) return;
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

  if (!target) return null;
  const label = labelFor(value).name as LabelName;

  const lock = async () => {
    if (busy) return;
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
        setValue(50);
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
      <div className="flex min-h-[84px] items-end justify-between gap-3">
        <span
          aria-hidden
          className="font-mono text-[88px] leading-[.85] font-semibold tracking-[-.05em] tabular-nums"
        >
          {value}
        </span>
        <span style={{ ...labelStickerStyle(label, 3, 17), marginBottom: 6 }}>{label}</span>
      </div>
      <ScoreSlider
        value={value}
        onChange={setValue}
        label={t("aria", { name: target.nickname })}
        valueText={t("valueText", { value, label })}
        lowerLabel={t("lower")}
        raiseLabel={t("raise")}
      />
      <div className="flex justify-between px-14 font-mono text-[13px] leading-none font-medium whitespace-nowrap text-text-muted">
        <span>{t("saint")}</span>
        <span>{t("menace")}</span>
      </div>
      <Button className="mt-auto" block loading={busy} onClick={lock}>
        {t("lock")}
      </Button>
    </div>
  );
}
