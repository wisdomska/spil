"use client";

import { FastForwardIcon } from "@phosphor-icons/react";
import { useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import {
  AWARD_KEY,
  AwardSticker,
  labelStickerStyle,
  type LabelName,
} from "@/components/brand/Stickers";
import { Vessel } from "@/components/brand/Vessel";
import type { AwardRow, ResultRow } from "@/lib/api/types";
import { labelById } from "@/lib/game";
import { frameAt, revealDuration, type RevealFrame } from "@/lib/room/revealTimeline";
import { useIsDesktop } from "@/lib/useMedia";

type Props = {
  rows: ResultRow[];
  awards: AwardRow[];
  /** Server time the room was revealed; clients align to it (max 2 s skew). */
  revealedAt?: string;
  onDone: () => void;
};

const sameFrame = (a: RevealFrame, b: RevealFrame) =>
  a.phase === b.phase &&
  ("player" in a ? a.player : -1) === ("player" in b ? b.player : -1) &&
  ("award" in a ? a.award : -1) === ("award" in b ? b.award : -1);

/**
 * Full-bleed reveal stage (max 560 wide at every size; it gets cast to TVs). One rAF timeline
 * writes the count to a motion value; React only re-renders when the beat changes.
 */
export function RevealStage({ rows, awards, revealedAt, onDone }: Props) {
  const t = useTranslations("reveal");
  const tl = useTranslations("labels");
  const ta = useTranslations("awards");
  const reduced = useReducedMotion() ?? false;
  const desktop = useIsDesktop();
  const order = useMemo(() => [...rows].sort((a, b) => a.score - b.score), [rows]);
  const scores = useMemo(() => order.map((r) => r.score), [order]);
  const [frame, setFrame] = useState<RevealFrame>(() => frameAt(0, scores, awards.length, reduced));
  const count = useMotionValue(0);
  const num = useTransform(count, (v) => String(Math.round(v)));
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const total = revealDuration(scores.length, awards.length);
    const skew = revealedAt ? Math.max(0, Date.now() - Date.parse(revealedAt)) : 0;
    // Phones align to the server's reveal time with at most 2 s of catch-up (spec section 8), so
    // a slow network never skips players. Arriving after the whole ceremony goes to results.
    const offset = skew > total ? total : Math.min(skew, 2000);
    const start = performance.now() - offset;
    let raf = 0;
    let last: RevealFrame | null = null;
    const tick = (now: number) => {
      const f = frameAt(now - start, scores, awards.length, reduced);
      if ("count" in f) count.set(f.count);
      if (!last || !sameFrame(last, f)) {
        last = f;
        setFrame(f);
        if (f.phase === "done") return doneRef.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scores, awards.length, revealedAt, reduced, count]);

  const awardMode = frame.phase === "beat" || frame.phase === "award";
  const player = "player" in frame ? order[frame.player] : order[order.length - 1];
  const awardIndex = "award" in frame ? frame.award : 0;
  const award = awards[awardIndex];
  const winner = award ? rows.find((r) => r.playerId === award.playerId) : undefined;
  const place = (k: number) => (k === 1 ? t("top") : t("place", { n: k }));
  const label = player ? (labelById(player.label).name as LabelName) : undefined;
  const labelKey = player ? labelKeyFor(player.label) : "fresh";

  return (
    <div className="mx-auto box-border flex min-h-[100dvh] w-full max-w-[560px] flex-col gap-[18px] px-5 pt-[18px] pb-7">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] whitespace-pre text-text-muted">
          {awardMode
            ? t("awardsCounter", { n: awardIndex + 1, total: awards.length })
            : t("counter", { n: ("player" in frame ? frame.player : 0) + 1, total: order.length })}
        </span>
        <button
          type="button"
          onClick={onDone}
          className="flex h-12 items-center gap-2 rounded-pill border-[1.5px] border-line bg-transparent px-[18px] text-[15px] leading-none font-semibold text-text hover:bg-surface-raised"
        >
          <FastForwardIcon size={18} aria-hidden />
          {t("skip")}
        </button>
      </div>

      {!awardMode && player && (
        <div className="flex flex-1 flex-col gap-[18px]">
          <div className="flex items-center gap-3.5">
            <Avatar n={player.avatar} size={64} label={player.nickname} />
            <div className="grid gap-[5px]">
              <span className="text-[14px] leading-none font-medium text-text-muted">
                {place(order.length - ("player" in frame ? frame.player : 0))}
              </span>
              <span className="font-display text-[42px] leading-[.95] font-extrabold tracking-[-.03em]">
                {player.nickname}
              </span>
            </div>
          </div>
          <div className="relative">
            <Vessel
              level={count}
              num={num}
              height={desktop ? 400 : 380}
              fontSize={150}
              radius={24}
            />
            {frame.phase === "label" && label && (
              <span
                className="absolute bottom-[-18px] left-[-6px] animate-slap"
                style={labelStickerStyle(label, -4, 26)}
              >
                {tl(labelKey)}
              </span>
            )}
          </div>
          <span className="mt-2.5 min-h-[22px] text-[16px] leading-[1.4] font-medium text-text-muted">
            {frame.phase === "label" ? t("guessed", { guess: player.avgGuessAbout }) : ""}
          </span>
          <span className="sr-only" aria-live="polite">
            {frame.phase === "label" && label
              ? t("announce", { name: player.nickname, score: player.score, label: tl(labelKey) })
              : ""}
          </span>
        </div>
      )}

      {awardMode && (
        <div aria-live="polite" className="flex flex-1 flex-col justify-center gap-6 pb-10">
          {frame.phase === "award" && award && winner && (
            <>
              <AwardSticker
                key={awardIndex}
                award={award.award}
                index={awardIndex}
                name={ta(AWARD_KEY[award.award])}
                animate={!reduced}
              />
              <div className="flex animate-[rise_300ms_200ms_var(--ease-out)_both] items-center gap-3.5">
                <Avatar n={winner.avatar} size={56} label={winner.nickname} />
                <span className="font-display text-[40px] leading-none font-extrabold tracking-[-.03em]">
                  {winner.nickname}
                </span>
              </div>
              <p className="m-0 animate-[rise_300ms_280ms_var(--ease-out)_both] text-[18px] leading-[1.5] text-text-muted">
                {award.reason}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const LABEL_KEYS = {
  fresh_out_the_box: "fresh",
  mostly_innocent: "innocent",
  been_around: "around",
  main_character: "main",
  legendary_menace: "menace",
} as const;

export function labelKeyFor(id: ResultRow["label"]) {
  return LABEL_KEYS[id];
}
