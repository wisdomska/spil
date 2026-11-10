"use client";

import {
  ArrowCounterClockwiseIcon,
  CaretRightIcon,
  CardsThreeIcon,
  DetectiveIcon,
  DropIcon,
  FireIcon,
  FlagIcon,
  HandPointingIcon,
  MaskHappyIcon,
  PercentIcon,
  PlayIcon,
  QuotesIcon,
  RankingIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { stickerRot } from "@/components/brand/Stickers";
import { Vessel } from "@/components/brand/Vessel";
import { Spinner } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  MODE_RULES,
  setupModes,
  setupPath,
  type Mode,
  type ModeGroupId,
  type PackFormat,
  type SetupPath,
} from "@/lib/game";

type SetupPack = { id: string; name: string; format: PackFormat; locked: boolean };

export type PlayAgain = { mode: Mode; packId: string; packName: string; count: number };

type Props = {
  packs: SetupPack[];
  floor: number;
  /** A game that starts in one tap is being created: show its spinner, hold the others. */
  starting: Mode | null;
  /** In a room: the game it plays now (marked as current). */
  current?: Mode;
  playAgain?: PlayAgain | null;
  onPick: (mode: Mode, path: SetupPath) => void;
  onPlayAgain?: (last: PlayAgain) => void;
};

/** Each game's sticker glyph (Phosphor, like the pack glyphs). */
const GAME_ICON: Record<Mode, Icon> = {
  classic: DropIcon,
  room_percentage: PercentIcon,
  hot_takes: FireIcon,
  most_likely: HandPointingIcon,
  red_green: FlagIcon,
  rank_room: RankingIcon,
  imposter: DetectiveIcon,
  two_truths: MaskHappyIcon,
  who_said: QuotesIcon,
  spill_or_skip: DropIcon,
};

/** How full the classic's glass pours on arrival: the screen's one liquid moment. */
const POUR_LEVEL = 62;

/**
 * Step 1 of game setup (owner request 2026-10-26), laid out like a game's mode select: the
 * classic leads on a paper card with the pour, the rest are tiles in three numbered groups, each
 * with its own sticker. A game with one pack starts in one tap ("Start"); one with several
 * opens the pack step ("12 packs"). Each tile says which it will do before it is tapped.
 */
export function GameStep({
  packs,
  floor,
  starting,
  current,
  playAgain,
  onPick,
  onPlayAgain,
}: Props) {
  const t = useTranslations("setup");
  const tm = useTranslations("modes");
  const { featured, groups } = setupModes(floor);
  const busy = starting !== null;
  // The glass fills once the page is in, so the pour is seen.
  const [poured, setPoured] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPoured(POUR_LEVEL));
    return () => cancelAnimationFrame(id);
  }, []);

  const meta = (mode: Mode) => {
    const path = setupPath(packs, mode);
    const off = path.kind === "none";
    return {
      path,
      off,
      isStarting: starting === mode,
      held: off || (busy && starting !== mode),
      min: MODE_RULES[mode].minPlayers,
    };
  };

  const a11y = (mode: Mode, m: ReturnType<typeof meta>) => ({
    type: "button" as const,
    "aria-disabled": m.held || undefined,
    "aria-busy": m.isStarting || undefined,
    "aria-current": current === mode ? ("true" as const) : undefined,
    "aria-labelledby": `game-${mode}-name game-${mode}-cta`,
    "aria-describedby": `game-${mode}-body`,
    onClick: () => !m.off && !busy && onPick(mode, m.path),
  });

  const players = (min: number, onPaper = false) => (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-pill border-[1.5px] px-2.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap",
        onPaper ? "border-tile-on-paper/25" : "border-line-strong",
      )}
    >
      {min === 1 ? (
        <UserIcon aria-hidden size={14} weight="bold" />
      ) : (
        <UsersThreeIcon aria-hidden size={14} weight="bold" />
      )}
      {min === 1 ? t("solo") : t("minPlayers", { n: min })}
    </span>
  );

  /** The tile's call to action: Start now for one tap, the pack count otherwise. */
  const cta = (mode: Mode, m: ReturnType<typeof meta>, onPaper = false) => (
    <span
      id={`game-${mode}-cta`}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-pill text-[15px] leading-none font-bold whitespace-nowrap transition-[scale] duration-150 ease-out group-active:scale-95",
        onPaper ? "px-4" : "w-full px-3",
        // One style for every playable game, featured or not (UX audit 2026-11-09): the label
        // says what happens, Start now for one tap, the pack count when there is a choice.
        m.off ? "border-[1.5px] border-line text-text-muted" : "bg-accent text-on-accent",
      )}
    >
      {m.isStarting ? (
        <>
          <Spinner />
          <span className="sr-only">{t("starting", { game: tm(`${mode}.name`) })}</span>
        </>
      ) : m.path.kind === "start" ? (
        <>
          <PlayIcon aria-hidden size={16} weight="fill" />
          {t("start")}
        </>
      ) : m.path.kind === "choose" ? (
        <>
          <CardsThreeIcon aria-hidden size={18} weight="bold" />
          {t("packs", { n: m.path.packs })}
          <CaretRightIcon aria-hidden size={14} weight="bold" />
        </>
      ) : (
        t("unavailable")
      )}
    </span>
  );

  const nowChip = (mode: Mode) =>
    current === mode && (
      <span className="inline-flex h-7 items-center rounded-pill bg-accent px-2.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap text-on-accent">
        {t("current")}
      </span>
    );

  const hero = (mode: Mode) => {
    const m = meta(mode);
    return (
      <button
        key={mode}
        {...a11y(mode, m)}
        className={cn(
          "group relative grid w-full animate-rise grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-card bg-tile-paper p-5 text-left text-tile-on-paper sm:gap-8 sm:p-7",
          m.held ? "cursor-not-allowed opacity-50" : "hover:brightness-[1.04] active:scale-[.99]",
        )}
        style={{
          boxShadow: current === mode ? "0 0 0 2px var(--bg), 0 0 0 4px var(--accent)" : "none",
        }}
      >
        <span className="grid min-w-0 justify-items-start gap-3">
          <span
            className="inline-flex items-center rounded-[10px] border-[3px] border-sticker-edge bg-accent px-2.5 py-1.5 font-mono text-[12px] leading-none font-bold tracking-[.06em] text-on-accent uppercase"
            style={{ boxShadow: "0 0 0 1.5px var(--sticker-ring)", rotate: "-3deg" }}
          >
            {t("featuredTag")}
          </span>
          <span
            id={`game-${mode}-name`}
            className="font-display text-[34px] leading-[.95] font-extrabold tracking-display text-balance sm:text-[48px]"
          >
            {tm(`${mode}.name`)}
          </span>
          <span
            id={`game-${mode}-body`}
            className="max-w-[44ch] text-[15px] leading-[1.4] text-pretty sm:text-[16px]"
          >
            {tm(`${mode}.body`)}
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {players(m.min, true)}
            {nowChip(mode)}
          </span>
          <span className="pt-1">{cta(mode, m, true)}</span>
        </span>
        <span className="w-[72px] sm:w-[112px]">
          <Vessel
            level={poured}
            height={140}
            radius={22}
            transition="transform 1400ms var(--ease-out)"
            className="hidden sm:block"
          />
          <Vessel
            level={poured}
            height={104}
            radius={18}
            transition="transform 1400ms var(--ease-out)"
            className="sm:hidden"
          />
        </span>
      </button>
    );
  };

  const tile = (mode: Mode, i: number, wide: boolean) => {
    const m = meta(mode);
    const Glyph = GAME_ICON[mode];
    const adult = MODE_RULES[mode].adultOnly;
    return (
      <button
        key={mode}
        {...a11y(mode, m)}
        className={cn(
          "group flex h-full w-full animate-rise flex-col items-start gap-3 rounded-card border-[1.5px] p-4 text-left",
          // An odd last tile takes the whole row on phones instead of sitting alone.
          wide && "col-span-2 lg:col-span-1",
          adult ? "bg-tile-night text-tile-on-night" : "bg-surface text-text",
          current === mode ? "border-accent" : "border-line",
          m.held
            ? "cursor-not-allowed opacity-50"
            : "hover:border-line-strong hover:bg-surface-raised active:scale-[.98]",
        )}
        style={{ animationDelay: `${80 + i * 45}ms` }}
      >
        <span className="flex w-full flex-wrap items-start justify-between gap-2">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-full border-[3px] border-sticker-edge transition-[rotate,scale] duration-200 ease-out group-hover:scale-110 group-hover:rotate-0"
            style={{
              background: adult ? "var(--adult-badge)" : "var(--accent)",
              color: adult ? "var(--adult-badge-ink)" : "var(--tile-night-glyph-ink)",
              boxShadow: "0 0 0 1.5px var(--sticker-ring)",
              rotate: `${stickerRot(i) * 2}deg`,
            }}
          >
            <Glyph aria-hidden size={24} weight="bold" />
          </span>
          {adult && (
            <span className="inline-flex h-7 items-center rounded-pill border-[1.5px] border-adult-badge-edge bg-adult-badge px-2.5 font-mono text-[12px] leading-none font-bold whitespace-nowrap text-adult-badge-ink">
              {t("adult")}
            </span>
          )}
        </span>
        <span
          id={`game-${mode}-name`}
          className="font-display text-[21px] leading-none font-extrabold tracking-[-.02em] text-balance sm:text-[23px]"
        >
          {tm(`${mode}.name`)}
        </span>
        <span
          id={`game-${mode}-body`}
          className={cn(
            "text-[14px] leading-[1.4] text-pretty",
            adult ? "opacity-80" : "text-text-muted",
          )}
        >
          {tm(`${mode}.body`)}
        </span>
        <span className="mt-auto flex w-full flex-wrap items-center gap-2 pt-1">
          {players(m.min)}
          {nowChip(mode)}
        </span>
        {cta(mode, m)}
      </button>
    );
  };

  let dealt = 0;
  return (
    <div className="grid gap-8">
      {playAgain && onPlayAgain && (
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => !busy && onPlayAgain(playAgain)}
          className="flex animate-rise items-center gap-3 rounded-card border-[1.5px] border-accent bg-accent-soft px-4 py-3 text-left text-text hover:brightness-110 aria-disabled:opacity-50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
            <ArrowCounterClockwiseIcon aria-hidden size={20} weight="bold" />
          </span>
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="text-[13px] leading-none font-semibold text-accent-ink">
              {t("playAgain")}
            </span>
            {/* Wraps instead of cutting off "10 questions" on a phone. */}
            <span className="text-[15px] leading-[1.3] font-semibold text-pretty">
              {t("playAgainBody", {
                game: tm(`${playAgain.mode}.name`),
                pack: playAgain.packName,
                n: playAgain.count,
              })}
            </span>
          </span>
          {starting === playAgain.mode ? (
            <Spinner />
          ) : (
            <CaretRightIcon aria-hidden size={16} className="shrink-0 text-accent-ink" />
          )}
        </button>
      )}
      {featured && hero(featured)}
      {groups.map((g, gi) => (
        <section key={g.id} aria-labelledby={`setup-${g.id}`} className="grid gap-3.5">
          <h2
            id={`setup-${g.id}`}
            className="m-0 flex items-baseline gap-2.5 text-[13px] leading-none font-semibold tracking-wide text-text-muted uppercase"
          >
            <span aria-hidden className="font-mono text-[13px] font-bold text-accent-ink">
              {String(gi + 1).padStart(2, "0")}
            </span>
            {t(`groups.${g.id as ModeGroupId}`)}
          </h2>
          <div
            className={cn(
              "grid grid-cols-2 gap-3",
              g.modes.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2",
            )}
          >
            {g.modes.map((m, k) =>
              tile(m, dealt++, g.modes.length % 2 === 1 && k === g.modes.length - 1),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
