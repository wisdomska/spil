"use client";

import { ArrowCounterClockwiseIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
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

/**
 * Step 1 of game setup (owner request 2026-10-26): the classic leads, the rest sit in three
 * groups. A game with one pack starts in one tap ("Start"); one with several opens the pack
 * step ("12 packs"). Each card says which it will do before it is tapped.
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

  const card = (mode: Mode, big = false) => {
    const path = setupPath(packs, mode);
    const off = path.kind === "none";
    const isStarting = starting === mode;
    const min = MODE_RULES[mode].minPlayers;
    return (
      <button
        key={mode}
        type="button"
        aria-disabled={off || (busy && !isStarting) || undefined}
        aria-busy={isStarting || undefined}
        aria-current={current === mode ? "true" : undefined}
        aria-labelledby={`game-${mode}-name game-${mode}-cta`}
        aria-describedby={`game-${mode}-body`}
        onClick={() => !off && !busy && onPick(mode, path)}
        className={cn(
          "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-card border-[1.5px] text-left text-text",
          big ? "p-5 sm:p-6" : "p-4",
          current === mode ? "border-accent bg-accent-soft" : "border-line bg-surface",
          off || (busy && !isStarting)
            ? "cursor-not-allowed opacity-50"
            : "hover:border-text-muted hover:bg-surface-raised active:scale-[.99]",
        )}
      >
        <span className="grid min-w-0 gap-1.5">
          {big && (
            <span className="font-mono text-[12px] leading-none font-semibold tracking-[.06em] text-accent-ink uppercase">
              {t("featuredTag")}
            </span>
          )}
          <span
            id={`game-${mode}-name`}
            className={cn(
              "font-display leading-none font-extrabold",
              big ? "text-[30px] tracking-[-.02em] sm:text-[34px]" : "text-[20px]",
            )}
          >
            {tm(`${mode}.name`)}
          </span>
          <span
            id={`game-${mode}-body`}
            className="text-[14px] leading-[1.4] text-pretty text-text-muted"
          >
            {tm(`${mode}.body`)}
          </span>
          <span className="flex flex-wrap gap-1.5 pt-0.5">
            <span className="rounded-pill border border-line px-2 py-1 font-mono text-[11px] leading-none font-semibold text-text-muted">
              {min === 1 ? t("solo") : t("minPlayers", { n: min })}
            </span>
            {MODE_RULES[mode].adultOnly && (
              <span className="rounded-pill border border-line px-2 py-1 font-mono text-[11px] leading-none font-semibold text-text-muted">
                {t("adult")}
              </span>
            )}
            {current === mode && (
              <span className="rounded-pill bg-accent px-2 py-1 font-mono text-[11px] leading-none font-semibold text-on-accent">
                {t("current")}
              </span>
            )}
          </span>
        </span>
        <span
          id={`game-${mode}-cta`}
          className={cn(
            "flex items-center gap-1.5 justify-self-end text-[14px] leading-none font-semibold whitespace-nowrap",
            off ? "text-text-muted" : "text-accent-ink",
          )}
        >
          {isStarting ? (
            <>
              <Spinner />
              <span className="sr-only">{t("starting", { game: tm(`${mode}.name`) })}</span>
            </>
          ) : off ? (
            t("unavailable")
          ) : (
            <>
              {path.kind === "start" ? t("start") : t("packs", { n: path.packs })}
              <CaretRightIcon
                aria-hidden
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="grid gap-7">
      {playAgain && onPlayAgain && (
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => !busy && onPlayAgain(playAgain)}
          className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 text-left text-text hover:bg-surface-raised aria-disabled:opacity-50"
        >
          <ArrowCounterClockwiseIcon aria-hidden size={20} className="shrink-0 text-accent-ink" />
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="text-[13px] leading-none font-semibold text-text-muted">
              {t("playAgain")}
            </span>
            <span className="truncate text-[15px] leading-[1.2] font-semibold">
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
      {featured && card(featured, true)}
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`setup-${g.id}`} className="grid gap-3">
          <h2
            id={`setup-${g.id}`}
            className="m-0 text-[13px] leading-none font-semibold tracking-wide text-text-muted uppercase"
          >
            {t(`groups.${g.id as ModeGroupId}`)}
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">{g.modes.map((m) => card(m))}</div>
        </section>
      ))}
    </div>
  );
}
