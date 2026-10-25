"use client";

import { SpeakerHighIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
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
  questionStep,
  REVEAL_MS,
  revealSlides,
  slideMinMs,
  spillGroups,
  verdictBand,
  type GroupStep,
  type ImposterOutcome,
  type TruthsCard,
  type WhoSaidQuestion,
  type FlagQuestion,
  type LikelyQuestion,
  type PercentQuestion,
  type RankQuestion,
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
  /** Read the room modes: one slide per scored question instead of per tie group. */
  percent?: PercentQuestion[];
  /** Hot Takes: the number is the room's average rating, not a yes share. */
  average?: boolean;
  /** Most Likely To: one slide per prompt with the room's pick and the vote counts. */
  likely?: LikelyQuestion[];
  /** Red Flag, Green Flag: one slide per scenario with the room's split. */
  flags?: FlagQuestion[];
  /** Rank the Room: one slide per prompt with the room's order. */
  ranked?: RankQuestion[];
  /** Imposter: two slides, the room's vote then who the imposter was. */
  imposter?: ImposterOutcome;
  /** Two Truths: one slide per card. */
  cards?: TruthsCard[];
  /** Who Said That?: one slide per prompt, every answer with who wrote it. */
  said?: WhoSaidQuestion[];
  /** Dev fixtures only: hold the stage at this many ms into the slide. */
  freezeAt?: number;
  /** Party Mode screen: nothing to tap, no sound or host controls. */
  display?: boolean;
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
  percent,
  average = false,
  likely,
  flags,
  ranked,
  imposter,
  cards,
  said,
  freezeAt,
  display = false,
}: Props) {
  const t = useTranslations("reveal");
  const tl = useTranslations("labels");
  const ta = useTranslations("awards");
  const reduced = useReducedMotion() ?? false;
  const desktop = useIsDesktop();
  const sound = useSoundSetting();
  const groups = useMemo(() => spillGroups(rows), [rows]);
  const slides = useMemo(
    () =>
      percent
        ? revealSlides(percent.length, awards.length, "question")
        : imposter
          ? revealSlides(2, awards.length, "question")
          : cards
            ? revealSlides(cards.length, awards.length, "question")
            : said
              ? revealSlides(said.length, awards.length, "question")
              : likely || flags || ranked
                ? revealSlides((likely ?? flags ?? ranked)!.length, awards.length, "question")
                : revealSlides(groups.length, awards.length),
    [percent, likely, flags, ranked, imposter, cards, said, groups, awards],
  );
  const slide = slides[Math.min(reveal.index, slides.length - 1)];
  const startedAt = Date.parse(reveal.at);

  // One clock per slide: the step only re-renders when it changes; the count is a motion value.
  const count = useMotionValue(0);
  const num = useTransform(count, (v) => String(Math.round(v)));
  const pct = useTransform(count, (v) => `${Math.round(v)}${average ? "" : "%"}`);
  const [step, setStep] = useState<GroupStep>("intro");
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(false);
  const lastStep = useRef<GroupStep | null>(null);

  const group = slide?.kind === "group" ? groups[slide.group] : undefined;
  const question = slide?.kind === "question" ? percent?.[slide.question] : undefined;
  const prompt = slide?.kind === "question" ? likely?.[slide.question] : undefined;
  const scenario = slide?.kind === "question" ? flags?.[slide.question] : undefined;
  const ordered = slide?.kind === "question" ? ranked?.[slide.question] : undefined;
  const imposterStep = slide?.kind === "question" && imposter ? slide.question : null;
  const card = slide?.kind === "question" ? cards?.[slide.question] : undefined;
  const saidQ = slide?.kind === "question" ? said?.[slide.question] : undefined;
  // The vessel fills to the share of votes the room's pick got.
  const promptShare = prompt
    ? Math.round(((prompt.tally[0]?.count ?? 0) / Math.max(1, prompt.voters)) * 100)
    : 0;
  const topBeat = slide ? hasTopBeat(slide, groups.length) : false;
  const minMs = slide ? slideMinMs(slide, groups.length) : 0;

  useEffect(() => {
    if (!slide) return;
    lastStep.current = null;
    const score =
      group?.score ?? question?.actual ?? (prompt ? promptShare : (scenario?.greenShare ?? 0));
    const at = (ms: number) => {
      if (
        group ||
        question ||
        prompt ||
        scenario ||
        ordered ||
        card ||
        saidQ ||
        imposterStep !== null
      ) {
        const g = group ? groupStep(ms, topBeat) : questionStep(ms);
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
  }, [
    slide,
    group,
    question,
    prompt,
    promptShare,
    scenario,
    ordered,
    imposterStep,
    card,
    saidQ,
    topBeat,
    minMs,
    startedAt,
    reduced,
    count,
    freezeAt,
  ]);

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
      : slide.kind === "question"
        ? imposter
          ? t("counter", { n: slide.question + 1, total: 2 })
          : cards
            ? t("counter", { n: slide.question + 1, total: cards.length })
            : said
              ? t("counter", { n: slide.question + 1, total: said.length })
              : ranked
                ? t("promptCounter", { n: slide.question + 1, total: ranked.length })
                : flags
                  ? t("scenarioCounter", { n: slide.question + 1, total: flags.length })
                  : likely
                    ? t("promptCounter", { n: slide.question + 1, total: likely.length })
                    : t(average ? "takeCounter" : "questionCounter", {
                        n: slide.question + 1,
                        total: percent?.length ?? 0,
                      })
        : t("counter", { n: slide.group + 1, total: groups.length });

  return (
    <div className="mx-auto box-border flex min-h-[100dvh] w-full max-w-[560px] flex-col gap-[18px] overflow-x-clip px-5 pt-[18px] pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] whitespace-pre text-text-muted">
          {counter}
        </span>
        <div className={cn("flex items-center gap-1.5", display && "hidden")}>
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
                showGuess={showGuess && (r.guessedBy ?? 0) > 0}
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
              {group.rows
                .filter((r) => (r.guessedBy ?? 0) > 0)
                .map((r) => {
                  const band = verdictBand(r.score - r.avgGuessAbout);
                  const verdict =
                    band === "well"
                      ? t("verdictWell")
                      : band === "little"
                        ? t("verdictLittle")
                        : t("verdictNone");
                  return (
                    <p key={r.playerId} className="m-0 text-[16px] leading-[1.4] font-medium">
                      {group.rows.length > 1 && (
                        <span className="font-semibold">{r.nickname}: </span>
                      )}
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

      {question && (
        <QuestionSlide
          question={question}
          rows={rows}
          count={count}
          pct={pct}
          step={step}
          stamped={stamped}
          reduced={reduced}
          height={desktop ? 360 : 300}
          kicker={
            stamped ? t(average ? "average" : "saidYes", { n: question.actual }) : t("nextUp")
          }
          guessText={(value, points) =>
            t(average ? "avgGuessPoints" : "guessPoints", { value, points })
          }
          closest={t("closest")}
          bullseye={t("bullseye")}
          none={t("noGuesses")}
          announce={
            stamped
              ? t(average ? "announceAverage" : "announceQuestion", { n: question.actual })
              : ""
          }
        />
      )}

      {prompt && (
        <LikelySlide
          prompt={prompt}
          rows={rows}
          count={count}
          pct={pct}
          step={step}
          stamped={stamped}
          reduced={reduced}
          height={desktop ? 300 : 220}
        />
      )}

      {saidQ && <SaidSlide q={saidQ} rows={rows} stamped={stamped} step={step} reduced={reduced} />}

      {card && (
        <CardSlide card={card} rows={rows} step={step} stamped={stamped} reduced={reduced} />
      )}

      {imposter && imposterStep !== null && (
        <ImposterSlide
          outcome={imposter}
          which={imposterStep === 0 ? "vote" : "reveal"}
          rows={rows}
          stamped={stamped}
          showing={step === "fill" || stamped}
          reduced={reduced}
        />
      )}

      {ordered && (
        <RankSlide ordered={ordered} rows={rows} step={step} stamped={stamped} reduced={reduced} />
      )}

      {scenario && (
        <FlagSlide
          scenario={scenario}
          count={count}
          pct={pct}
          step={step}
          stamped={stamped}
          reduced={reduced}
          height={desktop ? 320 : 260}
        />
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

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[5] border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px]",
          display && "hidden",
        )}
      >
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

/**
 * Room Percentage: the question, the room's real yes share filling the vessel, then everyone's
 * guess with its points, closest first. Bullseye marks an exact guess.
 */
function QuestionSlide({
  question,
  rows,
  count,
  pct,
  step,
  stamped,
  reduced,
  height,
  kicker,
  guessText,
  closest,
  bullseye,
  none,
  announce,
}: {
  question: PercentQuestion;
  rows: ResultRow[];
  count: MotionValue<number>;
  pct: MotionValue<string>;
  step: GroupStep;
  stamped: boolean;
  reduced: boolean;
  height: number;
  kicker: string;
  guessText: (value: number, points: number) => string;
  closest: string;
  bullseye: string;
  none: string;
  announce: string;
}) {
  const filling = step === "fill" || stamped;
  const guesses = [...question.guesses].sort(
    (a, b) =>
      Math.abs(a.value - question.actual) - Math.abs(b.value - question.actual) ||
      b.points - a.points,
  );
  const STAMP =
    "rounded-pill border-2 border-sticker-edge bg-accent px-1.5 py-0.5 font-display text-[10px] leading-none font-extrabold whitespace-nowrap text-on-accent uppercase";
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span
        key={stamped ? "share" : "next"}
        className={cn(
          "font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted",
          stamped && "animate-[fade_300ms_both]",
        )}
      >
        {kicker}
      </span>
      <h2 className="m-0 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
        {question.text}
      </h2>
      <Vessel
        level={filling ? count : 0}
        num={filling ? pct : ""}
        height={height}
        fontSize={96}
        radius={24}
      />
      {step === "verdict" && (
        <ul
          className={cn(
            "m-0 grid list-none gap-2.5 p-0",
            reduced ? "animate-[fade_300ms_both]" : "animate-[rise_300ms_var(--ease-out)_both]",
          )}
        >
          {guesses.length === 0 && (
            <li className="text-[16px] leading-[1.4] font-medium text-text-muted">{none}</li>
          )}
          {guesses.map((g) => {
            const who = rows.find((r) => r.playerId === g.playerId);
            if (!who) return null;
            return (
              <li key={g.playerId} className="flex items-center gap-3">
                <Avatar n={who.avatar} size={32} label={who.nickname} />
                <span className="min-w-0 flex-1 truncate text-[16px] leading-none font-semibold">
                  {who.nickname}
                </span>
                {g.value === question.actual && (
                  <span
                    className={STAMP}
                    style={{ boxShadow: "0 0 0 1px var(--sticker-ring)", rotate: "-6deg" }}
                  >
                    {bullseye}
                  </span>
                )}
                {g.closest && g.value !== question.actual && (
                  <span
                    className={STAMP}
                    style={{ boxShadow: "0 0 0 1px var(--sticker-ring)", rotate: "-6deg" }}
                  >
                    {closest}
                  </span>
                )}
                <span className="font-mono text-[14px] leading-none font-medium whitespace-nowrap text-text-muted tabular-nums">
                  {guessText(g.value, g.points)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

/**
 * Most Likely To: the prompt, the vessel filling to the pick's share of the votes, the room's
 * pick stamped, then every player who got votes with their count. Never who voted for whom.
 */
function LikelySlide({
  prompt,
  rows,
  count,
  pct,
  step,
  stamped,
  reduced,
  height,
}: {
  prompt: LikelyQuestion;
  rows: ResultRow[];
  count: MotionValue<number>;
  pct: MotionValue<string>;
  step: GroupStep;
  stamped: boolean;
  reduced: boolean;
  height: number;
}) {
  const t = useTranslations("reveal");
  const who = (id: string) => rows.find((r) => r.playerId === id);
  const top = prompt.top.map(who).filter((r) => r !== undefined);
  const most = prompt.tally[0]?.count ?? 0;
  const filling = step === "fill" || stamped;
  const names = top.map((r) => r.nickname).join(", ");
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {t("likelyKicker")}
      </span>
      <h2 className="m-0 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
        {prompt.text}
      </h2>
      <div className="relative">
        <Vessel
          level={filling ? count : 0}
          num={filling ? pct : ""}
          height={height}
          fontSize={80}
          radius={24}
        />
      </div>
      {stamped && (
        <div
          className={cn(
            "grid gap-2",
            reduced ? "animate-[fade_300ms_both]" : "animate-[rise_300ms_var(--ease-out)_both]",
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            {top.map((r) => (
              <span key={r.playerId} className="flex items-center gap-2.5">
                <Avatar n={r.avatar} size={48} label={r.nickname} />
                <span className="font-display text-[30px] leading-none font-extrabold tracking-[-.03em]">
                  {r.nickname}
                </span>
              </span>
            ))}
          </div>
          <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
            {top.length > 1
              ? t("likelyTie", { count: most, total: prompt.voters })
              : t("likelyPick", { count: most, total: prompt.voters })}
          </span>
        </div>
      )}
      {step === "verdict" && prompt.tally.length > top.length && (
        <ul
          className={cn(
            "m-0 grid list-none gap-2.5 p-0",
            reduced
              ? "animate-[fade_300ms_both]"
              : "animate-[rise_300ms_80ms_var(--ease-out)_both]",
          )}
        >
          {prompt.tally
            .filter((x) => !prompt.top.includes(x.playerId))
            .map((x) => {
              const r = who(x.playerId);
              if (!r) return null;
              return (
                <li key={x.playerId} className="flex items-center gap-3">
                  <Avatar n={r.avatar} size={32} label={r.nickname} />
                  <span className="min-w-0 flex-1 truncate text-[16px] leading-none font-semibold">
                    {r.nickname}
                  </span>
                  <span className="font-mono text-[14px] leading-none font-medium text-text-muted tabular-nums">
                    {t("votes", { count: x.count })}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {stamped ? t("announceLikely", { names, count: most, total: prompt.voters }) : ""}
      </span>
    </div>
  );
}

/**
 * Red Flag, Green Flag: the scenario, the vessel filling to the green share, then the room's
 * verdict stamped and the split. Never who swiped what.
 */
function FlagSlide({
  scenario,
  count,
  pct,
  step,
  stamped,
  reduced,
  height,
}: {
  scenario: FlagQuestion;
  count: MotionValue<number>;
  pct: MotionValue<string>;
  step: GroupStep;
  stamped: boolean;
  reduced: boolean;
  height: number;
}) {
  const t = useTranslations("reveal");
  const filling = step === "fill" || stamped;
  const verdict =
    scenario.verdict === "green"
      ? t("flagGreen")
      : scenario.verdict === "red"
        ? t("flagRed")
        : t("flagSplit");
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {t("flagKicker")}
      </span>
      <h2 className="m-0 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
        {scenario.text}
      </h2>
      <div className="relative">
        <Vessel
          level={filling ? count : 0}
          num={filling ? pct : ""}
          height={height}
          fontSize={88}
          radius={24}
        />
        {stamped && (
          <span
            className={cn(
              "absolute bottom-[-14px] left-[-6px] rounded-pill border-4 border-sticker-edge px-3.5 py-2 font-display text-[22px] leading-none font-extrabold shadow-[0_0_0_1.5px_var(--sticker-ring)]",
              scenario.verdict === "green"
                ? "bg-accent text-on-accent"
                : "bg-inverse text-on-inverse",
              reduced ? "animate-[fade_300ms_both]" : "animate-slap",
            )}
            style={{ rotate: "-4deg" }}
          >
            {verdict}
          </span>
        )}
      </div>
      {step === "verdict" && (
        <p
          className={cn(
            "m-0 mt-2 font-mono text-[15px] leading-none font-medium text-text-muted",
            reduced ? "animate-[fade_300ms_both]" : "animate-[rise_300ms_var(--ease-out)_both]",
          )}
        >
          {t("flagSplitLine", { green: scenario.greenShare, red: 100 - scenario.greenShare })}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {stamped ? t("announceFlag", { verdict, green: scenario.greenShare }) : ""}
      </span>
    </div>
  );
}

/**
 * Rank the Room: the prompt, then the room's order filling in from the bottom, the top place
 * stamped. Only the room's order: never anyone's own ranking.
 */
function RankSlide({
  ordered,
  rows,
  step,
  stamped,
  reduced,
}: {
  ordered: RankQuestion;
  rows: ResultRow[];
  step: GroupStep;
  stamped: boolean;
  reduced: boolean;
}) {
  const t = useTranslations("reveal");
  const showing = step === "fill" || stamped;
  const n = ordered.order.length;
  const top = ordered.order.filter((p) => p.place === 1);
  const names = top
    .map((p) => rows.find((r) => r.playerId === p.playerId)?.nickname ?? "")
    .join(", ");
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {t("rankKicker")}
      </span>
      <h2 className="m-0 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
        {ordered.text}
      </h2>
      {showing && (
        <ol className="m-0 grid list-none gap-2 p-0">
          {ordered.order.map((p, i) => {
            const r = rows.find((x) => x.playerId === p.playerId);
            if (!r) return null;
            const first = p.place === 1;
            return (
              <li
                key={p.playerId}
                className={cn(
                  "relative flex min-h-14 items-center gap-3 rounded-card border px-3.5 py-2",
                  first && stamped ? "border-accent bg-accent-soft" : "border-line bg-surface",
                  reduced
                    ? "animate-[fade_300ms_both]"
                    : "animate-[rise_300ms_var(--ease-out)_both]",
                )}
                // The bottom of the order lands first, the top last.
                style={{ animationDelay: `${(n - 1 - i) * (reduced ? 0 : 220)}ms` }}
              >
                <span className="w-8 font-mono text-[15px] leading-none font-semibold tabular-nums">
                  {p.place}
                </span>
                <Avatar n={r.avatar} size={36} label={r.nickname} />
                <span className="min-w-0 flex-1 truncate font-display text-[19px] leading-none font-bold">
                  {r.nickname}
                </span>
                {first && stamped && (
                  <span
                    className={cn(
                      "rounded-pill border-[3px] border-sticker-edge bg-accent px-2.5 py-1.5 font-display text-[13px] leading-none font-extrabold whitespace-nowrap text-on-accent",
                      reduced ? "animate-[fade_300ms_both]" : "animate-slap",
                    )}
                    style={{ boxShadow: "0 0 0 1.5px var(--sticker-ring)", rotate: "-4deg" }}
                  >
                    {t("rankTop")}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <span className="sr-only" aria-live="polite">
        {stamped ? t("announceRank", { names }) : ""}
      </span>
    </div>
  );
}

/**
 * Imposter: slide 1 is the room's vote (counts only); slide 2 names the imposter, says whether
 * they were caught, and shows the questions they were asked instead.
 */
function ImposterSlide({
  outcome,
  which,
  rows,
  stamped,
  showing,
  reduced,
}: {
  outcome: ImposterOutcome;
  which: "vote" | "reveal";
  rows: ResultRow[];
  stamped: boolean;
  showing: boolean;
  reduced: boolean;
}) {
  const t = useTranslations("reveal");
  const who = (id: string | null) => rows.find((r) => r.playerId === id);
  const rise = reduced ? "animate-[fade_300ms_both]" : "animate-[rise_300ms_var(--ease-out)_both]";
  if (which === "vote") {
    const top = outcome.top.map(who).filter((r) => r !== undefined);
    const most = outcome.tally[0]?.count ?? 0;
    const names = top.map((r) => r.nickname).join(", ");
    return (
      <div className="flex flex-1 flex-col gap-[18px]">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("voteKicker")}
        </span>
        {showing && (
          <div className={cn("grid gap-3", rise)}>
            {top.length === 1 ? (
              <div className="flex items-center gap-3.5">
                <Avatar n={top[0]!.avatar} size={72} label={top[0]!.nickname} />
                <span className="font-display text-[44px] leading-none font-extrabold tracking-[-.03em]">
                  {top[0]!.nickname}
                </span>
              </div>
            ) : (
              <p className="m-0 font-display text-display-m leading-[1] font-extrabold tracking-display">
                {t("voteTie")}
              </p>
            )}
            <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
              {t("voteCount", { count: most, total: outcome.voters })}
            </span>
          </div>
        )}
        {stamped && (
          <ul className={cn("m-0 grid list-none gap-2.5 p-0", rise)}>
            {outcome.tally.map((x) => {
              const r = who(x.playerId);
              if (!r) return null;
              return (
                <li key={x.playerId} className="flex items-center gap-3">
                  <Avatar n={r.avatar} size={32} label={r.nickname} />
                  <span className="min-w-0 flex-1 truncate text-[16px] leading-none font-semibold">
                    {r.nickname}
                  </span>
                  <span className="font-mono text-[14px] leading-none font-medium text-text-muted tabular-nums">
                    {t("votes", { count: x.count })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <span className="sr-only" aria-live="polite">
          {stamped && names ? t("announceVote", { names }) : ""}
        </span>
      </div>
    );
  }
  const imp = who(outcome.imposterId);
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {t("imposterKicker")}
      </span>
      {showing && imp && (
        <div className={cn("flex items-center gap-3.5", rise)}>
          <Avatar n={imp.avatar} size={72} label={imp.nickname} />
          <span className="font-display text-[44px] leading-none font-extrabold tracking-[-.03em]">
            {imp.nickname}
          </span>
          {stamped && (
            <span
              className={cn(
                "ml-auto rounded-pill border-4 border-sticker-edge px-3 py-1.5 font-display text-[18px] leading-none font-extrabold whitespace-nowrap shadow-[0_0_0_1.5px_var(--sticker-ring)]",
                outcome.caught ? "bg-accent text-on-accent" : "bg-inverse text-on-inverse",
                reduced ? "animate-[fade_300ms_both]" : "animate-slap",
              )}
              style={{ rotate: "-6deg" }}
            >
              {outcome.caught ? t("caught") : t("escaped")}
            </span>
          )}
        </div>
      )}
      {stamped && (
        <div className={cn("grid gap-2", rise)}>
          <span className="text-[15px] leading-none font-semibold text-text-muted">
            {t("theyWere")}
          </span>
          <ul className="m-0 grid list-none gap-2 p-0">
            {outcome.board.map((b) => (
              <li
                key={b.questionId}
                className="rounded-card border border-line bg-surface px-3.5 py-2.5 text-[15px] leading-[1.35] font-medium"
              >
                {b.altText}
              </li>
            ))}
          </ul>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {stamped && imp ? t("announceImposter", { name: imp.nickname }) : ""}
      </span>
    </div>
  );
}

/**
 * Two Truths and a Spill: the player's three questions, then the spill stamped and the truths
 * marked, with how many picked each one. Only the three questions the player chose to show.
 */
function CardSlide({
  card,
  rows,
  step,
  stamped,
  reduced,
}: {
  card: TruthsCard;
  rows: ResultRow[];
  step: GroupStep;
  stamped: boolean;
  reduced: boolean;
}) {
  const t = useTranslations("reveal");
  const tq = useTranslations("question");
  const owner = rows.find((r) => r.playerId === card.playerId);
  const spillText = card.items.find((i) => i.questionId === card.spill)?.text ?? "";
  const rise = reduced ? "animate-[fade_300ms_both]" : "animate-[rise_300ms_var(--ease-out)_both]";
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted uppercase">
        {t("cardKicker", { name: owner?.nickname ?? "" })}
      </span>
      {owner && <Avatar n={owner.avatar} size={64} label={owner.nickname} />}
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {card.items.map((item) => {
          const isSpill = item.questionId === card.spill;
          return (
            <li
              key={item.questionId}
              className={cn(
                "relative grid gap-2 rounded-card border px-4 py-3.5",
                stamped && isSpill ? "border-accent bg-accent-soft" : "border-line bg-surface",
              )}
            >
              <span className="pr-16 text-[17px] leading-[1.3] font-semibold">
                {tq("haveYouEver")} {item.text}
              </span>
              {step === "verdict" && (
                <span
                  className={cn(
                    "font-mono text-[13px] leading-none font-medium text-text-muted",
                    rise,
                  )}
                >
                  {t("picked", { count: card.spotted[item.questionId] ?? 0 })}
                </span>
              )}
              {stamped && (
                <span
                  className={cn(
                    "absolute top-3 right-3 rounded-pill border-[3px] border-sticker-edge px-2.5 py-1 font-display text-[13px] leading-none font-extrabold whitespace-nowrap",
                    isSpill ? "bg-accent text-on-accent" : "bg-inverse text-on-inverse",
                    reduced ? "animate-[fade_300ms_both]" : "animate-slap",
                  )}
                  style={{
                    boxShadow: "0 0 0 1.5px var(--sticker-ring)",
                    rotate: isSpill ? "-6deg" : "4deg",
                  }}
                >
                  {isSpill ? t("spillStamp") : t("truthStamp")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="sr-only" aria-live="polite">
        {stamped ? t("announceCard", { name: owner?.nickname ?? "", text: spillText }) : ""}
      </span>
    </div>
  );
}

/** Who Said That?: the prompt and every answer, then who wrote each and how many guessed it. */
function SaidSlide({
  q,
  rows,
  stamped,
  step,
  reduced,
}: {
  q: WhoSaidQuestion;
  rows: ResultRow[];
  stamped: boolean;
  step: GroupStep;
  reduced: boolean;
}) {
  const t = useTranslations("reveal");
  const rise = reduced ? "animate-[fade_300ms_both]" : "animate-[rise_300ms_var(--ease-out)_both]";
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {t("saidKicker")}
      </span>
      <h2 className="m-0 font-display text-[26px] leading-[1.1] font-extrabold tracking-[-.02em] text-balance">
        {q.text}
      </h2>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {q.answers.map((a) => {
          const who = rows.find((r) => r.playerId === a.playerId);
          return (
            <li
              key={a.id}
              className="grid gap-2 rounded-card border border-line bg-surface px-4 py-3.5"
            >
              <span className="text-[17px] leading-[1.35] font-semibold">
                {a.hidden ? <span className="text-text-muted">{t("hiddenAnswer")}</span> : a.body}
              </span>
              {stamped && who && (
                <span
                  className={cn("flex items-center gap-2 text-[15px] leading-none font-bold", rise)}
                >
                  <Avatar n={who.avatar} size={28} label={who.nickname} />
                  {who.nickname}
                  {step === "verdict" && a.guessers > 0 && (
                    <span className="ml-auto font-mono text-[13px] font-medium text-text-muted">
                      {t("saidRight", { right: a.right, total: a.guessers })}
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="sr-only" aria-live="polite">
        {stamped ? t("announceSaid", { text: q.text }) : ""}
      </span>
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
