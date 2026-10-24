"use client";

import { FastForwardIcon, SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import { useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
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
import { Button } from "@/components/ui/Button";
import type { AwardRow, ResultRow } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import {
  groupStep,
  hasTopBeat,
  labelById,
  REVEAL_MS,
  revealSlides,
  slideMinMs,
  spillGroups,
  verdictBand,
  type GroupStep,
} from "@/lib/game";
import { playSound, primeSound, useSoundSetting } from "@/lib/sound";
import { useIsDesktop } from "@/lib/useMedia";

type Props = {
  rows: ResultRow[];
  awards: AwardRow[];
  /** Exact guesses, shown as Bullseye stamps under the verdict. */
  exact: Array<{ guesserId: string; targetId: string }>;
  /** The server's slide and when it began (SPIL-11). */
  reveal: { index: number; at: string };
  isHost: boolean;
  hostName: string;
  /** Host: move every phone on from slide `expected`. */
  onNext: (expected: number) => void;
  nexting?: boolean;
  /** Host: jump every phone to the results. */
  onSkip: () => void;
  /** Dev fixtures only: hold the stage at this many ms into the slide. */
  freezeAt?: number;
};

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

/**
 * The reveal (SPIL-11): host-paced, one slide per tie group, then the awards. Each group goes
 * intro ("NEXT UP"), the room's guess as a dashed line, the fill with a count-up, the label
 * stamp with the rank, then the verdict. Every phone renders the server's slide and works out
 * the step from when it began, so phones stay in step; only the host moves it on.
 */
export function RevealStage({
  rows,
  awards,
  exact,
  reveal,
  isHost,
  hostName,
  onNext,
  nexting,
  onSkip,
  freezeAt,
}: Props) {
  const t = useTranslations("reveal");
  const tl = useTranslations("labels");
  const ta = useTranslations("awards");
  const reduced = useReducedMotion() ?? false;
  const desktop = useIsDesktop();
  const sound = useSoundSetting();
  const groups = useMemo(() => spillGroups(rows), [rows]);
  const slides = useMemo(() => revealSlides(groups.length, awards.length), [groups, awards]);
  const slide = slides[Math.min(reveal.index, slides.length - 1)];
  const startedAt = Date.parse(reveal.at);

  // One clock per slide: the step only re-renders when it changes; the count is a motion value.
  const count = useMotionValue(0);
  const num = useTransform(count, (v) => String(Math.round(v)));
  const [step, setStep] = useState<GroupStep>("intro");
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(false);
  const lastStep = useRef<GroupStep | null>(null);

  const group = slide?.kind === "group" ? groups[slide.group] : undefined;
  const topBeat = slide ? hasTopBeat(slide, groups.length) : false;
  const minMs = slide ? slideMinMs(slide, groups.length) : 0;

  useEffect(() => {
    if (!slide) return;
    lastStep.current = null;
    const score = group?.score ?? 0;
    const at = (ms: number) => {
      if (group) {
        const g = groupStep(ms, topBeat);
        count.set(
          g.step === "fill"
            ? reduced
              ? score
              : Math.round(score * easeOutCubic(g.fill))
            : g.step === "stamp" || g.step === "verdict"
              ? score
              : 0,
        );
        if (g.step !== lastStep.current) {
          if (lastStep.current !== null) {
            if (g.step === "beat") playSound("drumroll");
            if (g.step === "fill") playSound("pour");
            if (g.step === "stamp") playSound("stamp");
          }
          lastStep.current = g.step;
          setStep(g.step);
        }
      }
      setElapsed((cur) => (Math.floor(cur / 250) === Math.floor(ms / 250) ? cur : ms));
      setReady(ms >= minMs);
    };
    if (freezeAt !== undefined) {
      at(freezeAt);
      return;
    }
    let raf = 0;
    const tick = () => {
      const ms = Math.max(0, Date.now() - (Number.isFinite(startedAt) ? startedAt : Date.now()));
      at(ms);
      if (ms < minMs + 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slide, group, topBeat, minMs, startedAt, reduced, count, freezeAt]);

  // Host with Auto on: move on a moment after Next unlocks.
  useEffect(() => {
    if (!isHost || !auto || !ready || nexting) return;
    const timer = setTimeout(() => onNext(reveal.index), REVEAL_MS.auto);
    return () => clearTimeout(timer);
  }, [isHost, auto, ready, nexting, onNext, reveal.index]);

  useEffect(() => {
    const prime = () => primeSound();
    window.addEventListener("pointerdown", prime, { once: true });
    return () => window.removeEventListener("pointerdown", prime);
  }, []);

  if (!slide) return null;
  const place = (k: number, tied: boolean) =>
    tied
      ? k === 1
        ? t("tieTop")
        : t("tiePlace", { n: k })
      : k === 1
        ? t("top")
        : t("place", { n: k });
  const stamped = step === "stamp" || step === "verdict";
  const showGuess = step !== "beat" && step !== "intro";
  const fade = reduced ? "animate-[fade_300ms_both]" : "";

  const counter =
    slide.kind === "award"
      ? t("awardsCounter", { n: slide.award + 1, total: awards.length })
      : t("counter", { n: slide.group + 1, total: groups.length });

  return (
    <div className="mx-auto box-border flex min-h-[100dvh] w-full max-w-[560px] flex-col gap-[18px] px-5 pt-[18px] pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] whitespace-pre text-text-muted">
          {counter}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={sound.on}
            aria-label={sound.on ? t("soundOn") : t("soundOff")}
            onClick={() => {
              primeSound();
              sound.toggle();
            }}
            className="grid size-12 place-items-center rounded-pill border-[1.5px] border-line bg-transparent text-[20px] text-text hover:bg-surface-raised"
          >
            {sound.on ? <SpeakerHighIcon aria-hidden /> : <SpeakerSlashIcon aria-hidden />}
          </button>
          {isHost && (
            <>
              <button
                type="button"
                aria-pressed={auto}
                onClick={() => setAuto((a) => !a)}
                className={cn(
                  "flex h-12 items-center rounded-pill border-[1.5px] px-3.5 text-[15px] leading-none font-semibold",
                  auto
                    ? "border-accent bg-accent-soft text-accent-ink"
                    : "border-line bg-transparent text-text hover:bg-surface-raised",
                )}
              >
                {t("auto")}
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="flex h-12 items-center gap-2 rounded-pill border-[1.5px] border-line bg-transparent px-[18px] text-[15px] leading-none font-semibold text-text hover:bg-surface-raised"
              >
                <FastForwardIcon size={18} aria-hidden />
                {t("skip")}
              </button>
            </>
          )}
        </div>
      </div>

      {group && step === "beat" && (
        <div className="flex flex-1 items-center">
          <p
            aria-live="polite"
            className={cn(
              "m-0 font-display text-display-m leading-[1] font-extrabold tracking-display text-balance",
              fade,
            )}
          >
            {t("topBeat")}
          </p>
        </div>
      )}

      {group && step !== "beat" && (
        <div className="flex flex-1 flex-col gap-[18px]">
          <span
            key={stamped ? "rank" : "next"}
            className={cn(
              "font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted",
              stamped && "animate-[fade_300ms_both]",
            )}
          >
            {stamped ? place(group.place, group.rows.length > 1) : t("nextUp")}
          </span>
          <div
            className={cn(
              "flex gap-3",
              group.rows.length > 2 && "-mx-5 snap-x snap-mandatory overflow-x-auto px-5 pb-6",
            )}
          >
            {group.rows.map((r) => (
              <PlayerVessel
                key={r.playerId}
                row={r}
                count={count}
                num={num}
                step={step}
                showGuess={showGuess}
                stamped={stamped}
                reduced={reduced}
                compact={group.rows.length > 1}
                many={group.rows.length > 2}
                height={group.rows.length > 1 ? (desktop ? 360 : 300) : desktop ? 400 : 360}
                label={tl(labelKeyFor(r.label))}
                guessTag={t("roomGuessed", { guess: r.avgGuessAbout })}
              />
            ))}
          </div>
          {step === "verdict" && (
            <div className={cn("grid gap-3", fade || "animate-[rise_300ms_var(--ease-out)_both]")}>
              {group.rows.map((r) => {
                const band = verdictBand(r.score - r.avgGuessAbout);
                const verdict =
                  band === "well"
                    ? t("verdictWell")
                    : band === "little"
                      ? t("verdictLittle")
                      : t("verdictNone");
                return (
                  <p key={r.playerId} className="m-0 text-[16px] leading-[1.4] font-medium">
                    {group.rows.length > 1 && <span className="font-semibold">{r.nickname}: </span>}
                    {t("offBy", { diff: Math.abs(r.score - r.avgGuessAbout), verdict })}
                  </p>
                );
              })}
              <Bullseyes
                rows={rows}
                exact={exact.filter((e) => group.rows.some((r) => r.playerId === e.targetId))}
                label={t("bullseye")}
              />
            </div>
          )}
          <span className="sr-only" aria-live="polite">
            {stamped
              ? group.rows
                  .map((r) =>
                    t("announce", {
                      name: r.nickname,
                      score: r.score,
                      label: tl(labelKeyFor(r.label)),
                    }),
                  )
                  .join(". ")
              : ""}
          </span>
        </div>
      )}

      {slide.kind === "award" && (
        <AwardSlide
          award={awards[slide.award]}
          index={slide.award}
          rows={rows}
          elapsed={elapsed}
          reduced={reduced}
          name={(a) => ta(AWARD_KEY[a])}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-[5] border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px]">
        <div className="mx-auto max-w-[520px]">
          {isHost ? (
            <Button
              block
              softDisabled={!ready}
              loading={nexting}
              onClick={() => ready && onNext(reveal.index)}
            >
              {t("next")}
            </Button>
          ) : (
            <p className="m-0 flex h-14 items-center justify-center text-[16px] leading-none font-medium text-text-muted">
              {t("waitingHost", { host: hostName })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerVessel({
  row,
  count,
  num,
  step,
  showGuess,
  stamped,
  reduced,
  compact,
  many,
  height,
  label,
  guessTag,
}: {
  row: ResultRow;
  count: MotionValue<number>;
  num: MotionValue<string>;
  step: GroupStep;
  showGuess: boolean;
  stamped: boolean;
  reduced: boolean;
  compact: boolean;
  many: boolean;
  height: number;
  label: string;
  guessTag: string;
}) {
  const sticker = labelById(row.label).name as LabelName;
  return (
    <div
      className={cn(
        "grid content-start gap-3",
        many ? "w-[44%] shrink-0 snap-start" : compact ? "min-w-0 flex-1" : "w-full",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar n={row.avatar} size={compact ? 40 : 56} label={row.nickname} />
        <span
          className={cn(
            "truncate font-display leading-none font-extrabold tracking-[-.03em]",
            compact ? "text-[24px]" : "text-[40px]",
          )}
        >
          {row.nickname}
        </span>
      </div>
      <div className="relative">
        <Vessel
          level={step === "fill" || stamped ? count : 0}
          num={step === "fill" || stamped ? num : ""}
          height={height}
          fontSize={many ? 60 : compact ? 72 : 140}
          radius={24}
        />
        {showGuess && (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0",
              reduced ? "animate-[fade_300ms_both]" : "animate-[fade_400ms_both]",
            )}
            style={{ top: `${100 - row.avgGuessAbout}%` }}
          >
            <div className="border-t-2 border-dashed border-text" />
            <span className="absolute top-1.5 left-2 rounded-pill bg-bg px-2 py-1 text-[12px] leading-none font-semibold whitespace-nowrap text-text">
              {guessTag}
            </span>
          </div>
        )}
        {stamped && (
          <span
            className={cn(
              "absolute bottom-[-14px] left-[-6px]",
              reduced ? "animate-[fade_300ms_both]" : "animate-slap",
            )}
            style={labelStickerStyle(sticker, -4, compact ? 17 : 26)}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

function Bullseyes({
  rows,
  exact,
  label,
}: {
  rows: ResultRow[];
  exact: Array<{ guesserId: string; targetId: string }>;
  label: string;
}) {
  const guessers = [...new Set(exact.map((e) => e.guesserId))]
    .map((id) => rows.find((r) => r.playerId === id))
    .filter((r) => r !== undefined);
  if (!guessers.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {guessers.map((g) => (
        <span key={g.playerId} className="flex items-center gap-2">
          <span className="relative">
            <Avatar n={g.avatar} size={32} label={g.nickname} />
            <span
              className="absolute -right-3 -bottom-2 rounded-pill border-2 border-sticker-edge bg-accent px-1.5 py-0.5 font-display text-[10px] leading-none font-extrabold text-on-accent uppercase"
              style={{ boxShadow: "0 0 0 1px var(--sticker-ring)", rotate: "-6deg" }}
            >
              {label}
            </span>
          </span>
          <span className="ml-2 text-[14px] leading-none font-semibold">{g.nickname}</span>
        </span>
      ))}
    </div>
  );
}

function AwardSlide({
  award,
  index,
  rows,
  elapsed,
  reduced,
  name,
}: {
  award: AwardRow | undefined;
  index: number;
  rows: ResultRow[];
  elapsed: number;
  reduced: boolean;
  name: (award: AwardRow["award"]) => string;
}) {
  const winner = award ? rows.find((r) => r.playerId === award.playerId) : undefined;
  if (!award || !winner || elapsed < REVEAL_MS.awardBeat) return <div className="flex-1" />;
  return (
    <div aria-live="polite" className="flex flex-1 flex-col justify-center gap-6 pb-10">
      <AwardSticker
        key={index}
        award={award.award}
        index={index}
        name={name(award.award)}
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
