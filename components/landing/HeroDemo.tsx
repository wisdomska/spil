"use client";

import { DropIcon, HandPointingIcon, HandsPrayingIcon, HorseIcon } from "@phosphor-icons/react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { labelStickerStyle, type LabelName } from "@/components/brand/Stickers";
import { labelFor, verdictBand } from "@/lib/game";
import { useVesselDrag } from "@/lib/useVesselDrag";
import { levelForKey } from "@/lib/vessel";
import { Vessel } from "@/components/brand/Vessel";
import { track } from "@/lib/analytics/posthog";

const PEOPLE = [
  { name: "Jordan", avatar: 14, score: 88, award: "topSpiller", Icon: DropIcon },
  { name: "Maya", avatar: 9, score: 18, award: "saint", Icon: HandsPrayingIcon },
  { name: "Leo", avatar: 5, score: 41, award: "darkHorse", Icon: HorseIcon },
] as const;

const IDLE = [68, 36, 50];
// Where the vessel sits in the demo (top padding, phone border, header rows) and the sticker size.
const VESSEL_TOP = 126;
const VESSEL_H = 250;
const STICKER_H = 44;
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

/** The try-it phone on the landing page: drag the liquid to guess, then reveal (App hero). */
export function HeroDemo() {
  const t = useTranslations("landing.hero");
  const tAward = useTranslations("awards");
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [guess, setGuess] = useState(50);
  const level = useMotionValue(50);
  const num = useTransform(level, (v) => String(Math.round(v)));
  // SPIL-22: the label sticker sits at the liquid line, never lower than the vessel's bottom.
  const stickerTop = useTransform(
    level,
    (v) => VESSEL_TOP + (1 - Math.max(0, Math.min(100, v)) / 100) * VESSEL_H - STICKER_H / 2,
  );
  const [label, setLabel] = useState(labelFor(50));
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const person = PEOPLE[i % PEOPLE.length]!;
  useEffect(() => track("landing_viewed", {}), []);

  useMotionValueEvent(level, "change", (v) => {
    const next = labelFor(Math.round(v));
    setLabel((cur) => (cur === next ? cur : next));
  });

  // While idle the liquid moves without updating `guess`, so read it from the motion value.
  const currentGuess = () => (touched ? guess : Math.round(level.get()));

  const stopIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (!revealed) {
      anim.current?.stop();
      setGuess(Math.round(level.get()));
    }
    setTouched(true);
  }, [revealed, level]);

  // Idle loop: the liquid sloshes between three levels until someone touches it. Only the motion
  // value moves (no React render per frame); the guess syncs once when the loop stops.
  useEffect(() => {
    if (reduced || touched || revealed) return;
    let n = 0;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const to = IDLE[n++ % IDLE.length]!;
      anim.current = animate(level, to, {
        duration: 1.1,
        ease: easeInOutCubic,
        onComplete: () => {
          idleTimer.current = setTimeout(loop, 700);
        },
      });
    };
    idleTimer.current = setTimeout(loop, 900);
    return () => {
      alive = false;
      clearTimeout(idleTimer.current);
      anim.current?.stop();
    };
  }, [reduced, touched, revealed, level]);

  // Same drag and keys as the in-game guess (SPIL-10).
  const setLevel = (v: number) => {
    level.set(v);
    setGuess(v);
  };
  const { ref, dragging, handlers } = useVesselDrag(setLevel, !revealed);

  const reveal = () => {
    if (revealed) return;
    stopIdle();
    navigator.vibrate?.(10);
    setRevealed(true);
    const from = currentGuess();
    if (reduced) {
      level.set(person.score);
      return;
    }
    anim.current = animate(level, person.score, {
      duration: (900 + Math.abs(person.score - from) * 6) / 1000,
      ease: easeOutCubic,
    });
  };

  const next = () => {
    anim.current?.stop();
    setI((v) => v + 1);
    setRevealed(false);
    setGuess(50);
    level.set(50);
  };

  const off = Math.abs(guess - person.score);
  // SPIL-09: the same bands as the game's verdicts.
  const band = verdictBand(off);
  const verdict =
    band === "well" ? t("verdictMind") : band === "little" ? t("verdictNotBad") : t("verdictOff");
  const kicker = revealed
    ? i % PEOPLE.length === 0
      ? t("kickerTop")
      : t("kickerRevealed")
    : t("kickerAsk");
  const shown = Math.round(level.get());

  return (
    <div className="relative flex min-w-0 flex-[1_1_340px] justify-center pt-4 pb-6">
      <div className="relative box-border w-[280px] rounded-[44px] border border-line bg-surface p-[9px] shadow-[0_50px_90px_-50px_var(--shadow)]">
        <div className="box-border flex flex-col gap-3 overflow-hidden rounded-[36px] bg-bg px-4 pt-[22px] pb-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] leading-none font-medium tracking-[.06em] whitespace-nowrap text-accent-ink">
              {t("counter", { n: (i % PEOPLE.length) + 1, total: PEOPLE.length })}
            </span>
            <span className="font-mono text-[11px] leading-none font-medium tracking-[.06em] text-text-muted">
              {t("tryIt")}
            </span>
          </div>
          <div
            key={i}
            className={
              reduced ? "flex items-center gap-2.5" : "flex animate-rise items-center gap-2.5"
            }
          >
            <Avatar n={person.avatar} size={44} label={person.name} />
            <div className="grid gap-[3px]">
              <span className="text-[12px] leading-none font-medium text-text-muted">{kicker}</span>
              <span className="font-display text-[26px] leading-none font-extrabold tracking-[-.02em]">
                {person.name}
              </span>
            </div>
          </div>
          <div
            ref={ref}
            role="slider"
            tabIndex={0}
            aria-label={
              revealed
                ? t("ariaRevealed", { name: person.name, score: person.score })
                : t("ariaGuess", { name: person.name })
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={revealed ? shown : guess}
            aria-valuetext={`${revealed ? shown : guess}, ${label.name}`}
            className="relative rounded-card outline-offset-[3px]"
            style={{
              touchAction: "none",
              cursor: revealed ? "default" : dragging ? "grabbing" : "grab",
            }}
            {...handlers}
            onPointerDown={(e) => {
              if (revealed) return;
              stopIdle();
              handlers.onPointerDown(e);
            }}
            onKeyDown={(e) => {
              if (revealed) return;
              const v = levelForKey(e.key, currentGuess());
              if (v !== null) {
                e.preventDefault();
                stopIdle();
                setLevel(v);
              }
              if (e.key === "Enter") reveal();
            }}
          >
            <Vessel level={level} num={num} height={250} fontSize={104} />
            {!touched && !revealed && (
              <span
                aria-hidden
                className="pointer-events-none absolute top-2.5 right-2.5 flex animate-nudge items-center gap-1 rounded-pill bg-bg px-2.5 py-1.5 text-[11px] leading-none font-semibold text-text"
              >
                <HandPointingIcon size={14} />
                {t("drag")}
              </span>
            )}
          </div>
          <span
            aria-live="polite"
            className="min-h-[34px] text-[13px] leading-[1.3] font-medium text-pretty transition-colors duration-200"
            style={{ color: revealed ? "var(--text)" : "var(--text-muted)" }}
          >
            {revealed
              ? t("captionRevealed", { name: person.name, score: person.score, guess, verdict })
              : t("captionAsk")}
          </span>
          <button
            type="button"
            onClick={revealed ? next : reveal}
            className={
              revealed
                ? "h-11 shrink-0 rounded-pill border-[1.5px] border-text bg-transparent text-[15px] leading-none font-semibold text-text hover:brightness-[1.08]"
                : "h-11 shrink-0 rounded-pill border-0 bg-accent text-[15px] leading-none font-semibold text-on-accent hover:brightness-[1.08]"
            }
          >
            {revealed ? t("next") : t("reveal")}
          </button>
        </div>
      </div>
      <motion.span
        aria-hidden
        data-testid="demo-label"
        className="absolute"
        style={{ left: "calc(50% - 168px)", top: stickerTop, pointerEvents: "none", zIndex: 2 }}
      >
        <span
          key={label.id}
          className={reduced ? undefined : "animate-slap-quick"}
          style={{ ...labelStickerStyle(label.name as LabelName, -5, 20), display: "inline-flex" }}
        >
          {label.name}
        </span>
      </motion.span>
      {revealed && (
        <span
          aria-hidden
          className="absolute top-10 left-[calc(50%+58px)] box-border flex size-24 animate-slap flex-col items-center justify-center gap-1 rounded-full border-[5px] border-sticker-edge bg-accent p-1.5 text-center font-display text-[12px] leading-[1.05] font-extrabold text-on-accent"
          style={{
            boxShadow: "0 0 0 1.5px var(--sticker-ring), 0 10px 20px -10px var(--shadow)",
            transform: "rotate(7deg)",
          }}
        >
          <person.Icon size={22} />
          {tAward(person.award)}
        </span>
      )}
      {/* SPIL-22: the "You" pill sits on the phone's top-right corner, clear of every button. */}
      <span
        aria-hidden
        data-testid="demo-you"
        className="pointer-events-none absolute top-0 right-[calc(50%-150px)] z-[2] inline-flex items-center gap-2 rounded-pill border-[3px] border-sticker-edge bg-surface-raised py-1 pr-3.5 pl-1"
        style={{ boxShadow: "0 0 0 1.5px var(--sticker-ring)", transform: "rotate(3deg)" }}
      >
        <Avatar n={0} size={32} decorative />
        <span className="font-display text-[15px] leading-none font-bold">{t("you")}</span>
      </span>
    </div>
  );
}
