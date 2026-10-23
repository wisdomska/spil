"use client";

import {
  BellRingingIcon,
  CheckIcon,
  HourglassMediumIcon,
  SkipForwardIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { Vessel } from "@/components/brand/Vessel";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { RoomState, StatePlayer } from "@/lib/api/types";

type Props = {
  state: RoomState;
  onNudge: (players: StatePlayer[]) => void;
  onForce: () => void;
  forcing: boolean;
  /** Dev fixtures only: open the force-next sheet. */
  initialSheet?: boolean;
};

/** After you lock in: who is still going, the room's progress as a vessel, host tools. */
export function WaitingView({ state, onNudge, onForce, forcing, initialSheet = false }: Props) {
  const t = useTranslations("waiting");
  const c = useTranslations("common");
  const [sheet, setSheet] = useState(initialSheet);
  const guessing = state.room.status === "guessing";
  const total = state.room.questionCount;
  const active = state.players.filter((p) => p.status === "active");
  const done = (p: StatePlayer) => (guessing ? p.guessesSubmitted : p.answersSubmitted);
  const progress = (p: StatePlayer) => (guessing ? c("guessing") : `${p.answered}/${total}`);
  const unfinished = active.filter((p) => !done(p));
  const doneN = active.length - unfinished.length;
  const names = unfinished.map((p) => p.nickname);
  const title =
    unfinished.length === 0
      ? t("allDone")
      : unfinished.length === 1
        ? t("one", { name: names[0]! })
        : t("many", { names: names.slice(0, -1).join(", "), last: names[names.length - 1]! });
  const others = unfinished.filter((p) => p.id !== state.me.id);

  return (
    <div className="flex flex-1 flex-col gap-[22px]">
      <Vessel
        level={(doneN / Math.max(1, active.length)) * 100}
        num={`${doneN}/${Math.max(1, active.length)}`}
        height={190}
        fontSize={64}
        transition="transform 1.4s cubic-bezier(.2,.9,.3,1)"
      />
      <div className="grid gap-2.5">
        <h1
          aria-live="polite"
          className="m-0 font-display text-display-m leading-[.98] font-extrabold tracking-display text-balance"
        >
          {title}
        </h1>
        <p className="m-0 text-[16px] leading-[1.5] text-text-muted">
          {guessing ? t("bodyGuessing") : t("body")}
        </p>
      </div>
      <ul className="m-0 grid list-none p-0">
        {active.map((p) => {
          const d = done(p);
          return (
            <li key={p.id} className="flex items-center gap-3 border-b border-line py-[9px]">
              <Avatar n={p.avatar} size={36} label={p.nickname} />
              <span className="flex-1 text-[16px] leading-none font-semibold">
                {p.id === state.me.id ? c("youSuffix", { name: p.nickname }) : p.nickname}
              </span>
              <span
                className={
                  d
                    ? "flex items-center gap-1.5 text-[14px] leading-none font-semibold text-text"
                    : "flex items-center gap-1.5 font-mono text-[14px] leading-none font-medium text-text-muted"
                }
              >
                {d ? (
                  <CheckIcon size={16} aria-hidden />
                ) : (
                  <HourglassMediumIcon size={16} aria-hidden />
                )}
                {d ? c("done") : progress(p)}
              </span>
            </li>
          );
        })}
      </ul>
      {state.me.isHost && unfinished.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            className="min-w-[160px] flex-[1_1_auto]"
            onClick={() => onNudge(others)}
            softDisabled={!others.length}
          >
            <BellRingingIcon size={20} aria-hidden />
            {others.length === 1 ? t("nudgeOne", { name: others[0]!.nickname }) : t("nudgeMany")}
          </Button>
          <Button
            variant="ghost"
            className="flex-[1_1_auto] px-5 text-[16px]"
            onClick={() => setSheet(true)}
          >
            <SkipForwardIcon size={20} aria-hidden />
            {t("force")}
          </Button>
        </div>
      )}
      <Sheet
        open={sheet}
        onOpenChange={setSheet}
        title={t("forceTitle")}
        description={guessing ? t("forceBodyGuessing") : t("forceBody")}
      >
        <div className="grid">
          {unfinished.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-line py-2.5">
              <Avatar n={p.avatar} size={36} label={p.nickname} />
              <span className="flex-1 text-[16px] leading-none font-semibold">{p.nickname}</span>
              <span className="font-mono text-[13px] leading-none font-medium text-text-muted">
                {progress(p)}
              </span>
            </div>
          ))}
        </div>
        <Button
          variant="destructive"
          loading={forcing}
          onClick={() => {
            onForce();
            setSheet(false);
          }}
        >
          {t("force")}
        </Button>
        <Button variant="secondary" onClick={() => setSheet(false)}>
          {t("keepWaiting")}
        </Button>
      </Sheet>
    </div>
  );
}
