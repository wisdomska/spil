"use client";

import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
  DotsSixVerticalIcon,
} from "@phosphor-icons/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import { PourProgress } from "@/components/brand/PourProgress";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import type { RoomState, StatePlayer } from "@/lib/api/types";
import { startingOrder } from "@/lib/game";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
};

/**
 * Rank the Room: put everyone in the room in order on each prompt, yourself included, top is
 * "most". Drag a row by its handle or use the arrows. Each prompt starts from the same shuffle on
 * every phone, so nobody anchors on the roster. Saved debounced; locking the last one submits.
 */
export function RankView({ state, onDone }: Props) {
  const t = useTranslations("question");
  const tg = useTranslations("guess");
  const tt = useTranslations("toast");
  const toast = useToast();
  const questions = state.questions ?? [];
  const total = questions.length;
  const everyone = useMemo(
    () => state.players.filter((p) => p.status === "active"),
    [state.players],
  );
  const [ranks, setRanks] = useState<Record<string, string[]>>(() => ({
    ...(state.myRanks ?? {}),
  }));
  const [qi, setQi] = useState(() =>
    Math.max(
      0,
      questions.findIndex((q) => !(q.id in ranks)),
    ),
  );
  const q = questions[Math.min(qi, total - 1)];
  const orderFor = (id: string, from: Record<string, string[]>) => {
    const saved = from[id];
    const byId = new Map(everyone.map((p) => [p.id, p]));
    const kept = (saved ?? []).map((pid) => byId.get(pid)).filter((p) => p !== undefined);
    // A saved order that still covers everyone, otherwise the prompt's shuffle.
    return kept.length === everyone.length ? kept : startingOrder(everyone, id);
  };
  const [order, setOrder] = useState<StatePlayer[]>(() => (q ? orderFor(q.id, ranks) : []));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced save after a change (spec section 8: 400 ms).
  useEffect(() => {
    if (!q || !touched) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("PUT", `/rooms/${state.room.code}/ranks`, {
        ranks: [{ questionId: q.id, order: order.map((p) => p.id) }],
      }).catch(() => {
        // retried on lock
      });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [order, touched, q, state.room.code]);

  if (!q) return null;

  const goTo = (i: number, from: Record<string, string[]>) => {
    setQi(i);
    const id = questions[i]?.id;
    if (id) setOrder(orderFor(id, from));
    setTouched(false);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p!);
    setOrder(next);
    setTouched(true);
  };

  const lock = async () => {
    if (busy) return;
    setBusy(true);
    clearTimeout(saveTimer.current);
    const next = { ...ranks, [q.id]: order.map((p) => p.id) };
    try {
      await api("PUT", `/rooms/${state.room.code}/ranks`, {
        ranks: Object.entries(next).map(([questionId, ids]) => ({ questionId, order: ids })),
      });
      setRanks(next);
      const open = questions.findIndex((x) => !(x.id in next));
      if (open >= 0) goTo(open, next);
      else await onDone();
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };

  const done = Object.keys(ranks).filter((id) => questions.some((x) => x.id === id)).length;
  const STEP =
    "grid size-11 shrink-0 place-items-center rounded-pill border-0 bg-transparent text-[18px] text-text hover:bg-surface disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex flex-1 flex-col gap-[18px] xl:mx-auto xl:w-full xl:max-w-[720px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("previousPrompt")}
          onClick={() => qi > 0 && goTo(qi - 1, ranks)}
          className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
        >
          <ArrowLeftIcon aria-hidden />
        </button>
        <PourProgress value={Math.min(done, total)} total={total} label={t("progress")} />
        <span className="min-w-12 text-right font-mono text-[14px] leading-none font-medium tabular-nums">
          {qi + 1}/{total}
        </span>
      </div>
      <div className="grid gap-2.5">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted uppercase">
          {t("rankAsk")}
        </span>
        <h1 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
          {q.text}
        </h1>
        <p className="m-0 text-[14px] leading-[1.4] text-text-muted">{t("rankHint")}</p>
      </div>
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={(next) => {
          setOrder(next);
          setTouched(true);
        }}
        aria-label={t("rankAria", { n: qi + 1, total, text: q.text })}
        className="m-0 grid list-none gap-2 p-0"
      >
        {order.map((p, i) => (
          <RankRow
            key={p.id}
            player={p}
            place={i + 1}
            you={p.id === state.me.id}
            youLabel={t("rankYou", { name: p.nickname })}
            upLabel={t("moveUp", { name: p.nickname })}
            downLabel={t("moveDown", { name: p.nickname })}
            canUp={i > 0}
            canDown={i < order.length - 1}
            onUp={() => move(i, i - 1)}
            onDown={() => move(i, i + 1)}
            stepClass={STEP}
          />
        ))}
      </Reorder.Group>
      <div className="sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button block loading={busy} onClick={lock}>
          {tg("lock")}
        </Button>
      </div>
    </div>
  );
}

function RankRow({
  player,
  place,
  you,
  youLabel,
  upLabel,
  downLabel,
  canUp,
  canDown,
  onUp,
  onDown,
  stepClass,
}: {
  player: StatePlayer;
  place: number;
  you: boolean;
  youLabel: string;
  upLabel: string;
  downLabel: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  stepClass: string;
}) {
  const drag = useDragControls();
  return (
    <Reorder.Item
      value={player}
      dragListener={false}
      dragControls={drag}
      className="flex min-h-16 items-center gap-2 rounded-card border border-line bg-surface-raised py-1.5 pr-1.5 pl-1 select-none"
    >
      <span
        aria-hidden
        onPointerDown={(e) => drag.start(e)}
        className="grid h-12 w-9 shrink-0 cursor-grab place-items-center text-[20px] text-text-muted active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <DotsSixVerticalIcon />
      </span>
      <span className="w-7 shrink-0 font-mono text-[15px] leading-none font-semibold tabular-nums">
        {place}
      </span>
      <Avatar n={player.avatar} size={36} decorative />
      <span className="min-w-0 flex-1 truncate font-display text-[18px] leading-none font-bold">
        {you ? youLabel : player.nickname}
      </span>
      <button
        type="button"
        aria-label={upLabel}
        disabled={!canUp}
        onClick={onUp}
        className={stepClass}
      >
        <CaretUpIcon aria-hidden />
      </button>
      <button
        type="button"
        aria-label={downLabel}
        disabled={!canDown}
        onClick={onDown}
        className={stepClass}
      >
        <CaretDownIcon aria-hidden />
      </button>
    </Reorder.Item>
  );
}
