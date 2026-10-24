"use client";

import {
  ArrowLeftIcon,
  FlagIcon,
  HandSwipeRightIcon,
  LockSimpleIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { PourProgress } from "@/components/brand/PourProgress";
import { Spinner } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";
import { skipLimit, type AnswerValue } from "@/lib/game";
import { useAnswerQueue } from "@/lib/room/answerQueue";
import { useAnswerSync } from "@/lib/room/useRoom";

const FLICK_DISTANCE = 96;
const FLICK_MIN = 24;
const FLICK_VELOCITY = 0.11; // px per ms
const RETURN_EASE = [0.34, 1.3, 0.64, 1] as const;
const OUT_EASE = [0.23, 1, 0.32, 1] as const;

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
  /** Dev fixtures only: show a mid-drag card, saving or offline. */
  preview?: { dragX?: number; saving?: boolean; offline?: boolean };
};

export function QuestionView({ state, onDone, preview }: Props) {
  const t = useTranslations("question");
  const tr = useTranslations("report");
  const tt = useTranslations("toast");
  const c = useTranslations("common");
  const toast = useToast();
  const reduced = useReducedMotion();
  const questions = useMemo(() => state.questions ?? [], [state.questions]);
  const total = questions.length;
  const { record, pending, saving, offline, flush } = useAnswerSync(
    state.room.code,
    state.room.round,
  );
  // Answers given on this phone this round. The queue forgets them once they reach the server, and
  // the room state may not have refetched yet, so without this a flush between two answers would
  // send the card back to the first question.
  const [local, setLocal] = useState<Record<string, AnswerValue>>({});
  const localRef = useRef(local);
  const answers: Record<string, AnswerValue> = useMemo(
    () => ({ ...(state.myAnswers ?? {}), ...local, ...pending }),
    [state.myAnswers, local, pending],
  );
  const firstOpen = () => {
    const i = questions.findIndex((q) => !(q.id in answers));
    return i < 0 ? Math.max(0, total - 1) : i;
  };
  const [qi, setQi] = useState(firstOpen);
  // Refs so rapid key presses within one render each answer the next question, never the same one.
  const qiRef = useRef(qi);
  useEffect(() => {
    qiRef.current = qi;
  }, [qi]);
  const queueKey = `${state.room.code}:${state.room.round}`;
  const latestAnswers = (): Record<string, AnswerValue> => ({
    ...(state.myAnswers ?? {}),
    ...localRef.current,
    ...(useAnswerQueue.getState().pending[queueKey] ?? {}),
  });
  const [rise, setRise] = useState(0);
  const [report, setReport] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const flying = useRef(false);

  const x = useMotionValue(preview?.dragX ?? 0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, (v) => Math.max(-12, Math.min(12, v / 14)));
  const yesOpacity = useTransform(x, (v) => Math.max(0, Math.min(1, v / FLICK_DISTANCE)));
  const noOpacity = useTransform(x, (v) => Math.max(0, Math.min(1, -v / FLICK_DISTANCE)));

  const q = questions[Math.min(qi, total - 1)];

  const finishIfComplete = async (next: Record<string, AnswerValue>) => {
    if (questions.some((qq) => !(qq.id in next))) return false;
    setFinishing(true);
    try {
      // Every answer must be on the server before locking in; offline, it waits in the queue.
      if (!(await flush())) return false;
      await onDone();
    } finally {
      setFinishing(false);
    }
    return true;
  };

  const commit = (id: string, value: AnswerValue) => {
    record(id, value);
    localRef.current = { ...localRef.current, [id]: value };
    setLocal(localRef.current);
    const next = latestAnswers();
    const open = questions.findIndex((qq) => !(qq.id in next));
    if (open >= 0) {
      qiRef.current = open;
      setQi(open);
      setRise((r) => r + 1);
    }
    void finishIfComplete(next);
  };

  const answer = (value: AnswerValue, instant = false) => {
    const current = questions[Math.min(qiRef.current, total - 1)];
    if (!current || flying.current || finishing) return;
    const now = latestAnswers();
    const skips = Object.values(now).filter((v) => v === "skip").length;
    if (value === "skip" && now[current.id] !== "skip" && skips >= skipLimit(total)) {
      toast(t("skipLimit"), "err");
      return;
    }
    navigator.vibrate?.(10);
    if (instant || reduced || value === "skip") {
      x.set(0);
      commit(current.id, value);
      return;
    }
    flying.current = true;
    const dir = value === "yes" ? 1 : -1;
    animate(opacity, 0, { duration: 0.2, ease: "easeOut" });
    animate(x, dir * 520, {
      duration: 0.2,
      ease: OUT_EASE,
      onComplete: () => {
        flying.current = false;
        x.set(0);
        opacity.set(1);
        commit(current.id, value);
      },
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x;
    const v = Math.abs(info.velocity.x) / 1000; // px/s to px/ms
    if (Math.abs(dx) > FLICK_DISTANCE || (Math.abs(dx) > FLICK_MIN && v > FLICK_VELOCITY)) {
      answer(dx > 0 ? "yes" : "no");
    } else {
      animate(x, 0, { duration: 0.32, ease: RETURN_EASE });
    }
  };

  // Back after a refresh with every answer already given but not locked in: lock in now.
  const finishRef = useRef(finishIfComplete);
  useEffect(() => {
    finishRef.current = finishIfComplete;
  });
  useEffect(() => {
    if (total === 0) return;
    const id = setTimeout(() => void finishRef.current(latestAnswers()), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Y / N / arrow keys answer with no motion (HANDOFF "keyboard answer").
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (report || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "y", "Y"].includes(e.key)) answerRef.current("yes", true);
      if (["ArrowLeft", "n", "N"].includes(e.key)) answerRef.current("no", true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [report]);

  if (!q) return null;
  const answered = Object.keys(answers).filter((id) => questions.some((qq) => qq.id === id)).length;

  const ANS =
    "flex h-16 flex-1 items-center justify-center gap-2 rounded-pill border-[1.5px] text-[18px] leading-none font-bold not-aria-disabled:active:scale-[.97] hover:brightness-[1.08]";

  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      {(preview?.offline ?? offline) && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-input border border-line bg-surface-raised px-3.5 py-3 text-[15px] leading-[1.4] font-medium"
        >
          <WifiSlashIcon size={20} aria-hidden className="shrink-0 text-error" />
          <span>{t("offline")}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("previous")}
          onClick={() => qi > 0 && setQi(qi - 1)}
          className="grid size-12 shrink-0 place-items-center rounded-pill border border-line bg-transparent text-[20px] text-text hover:bg-surface-raised active:scale-[.92]"
        >
          <ArrowLeftIcon aria-hidden />
        </button>
        <PourProgress value={Math.min(qi, total)} total={total} label={t("progress")} />
        <span className="min-w-12 text-right font-mono text-[14px] leading-none font-medium tabular-nums">
          {qi + 1}/{total}
        </span>
        <button
          type="button"
          aria-label={t("skipAria")}
          onClick={() => answer("skip", true)}
          className="h-12 rounded-pill border-0 bg-transparent px-3 text-[15px] leading-none font-semibold text-text hover:bg-surface-raised"
        >
          {t("skip")}
        </button>
        <button
          type="button"
          aria-label={t("report")}
          onClick={() => setReport(true)}
          className="grid size-12 shrink-0 place-items-center rounded-pill border-0 bg-transparent text-[20px] text-text-muted hover:bg-surface-raised hover:text-text active:scale-[.92]"
        >
          <FlagIcon aria-hidden />
        </button>
      </div>

      <div className="relative mt-1 mb-3.5 max-h-[430px] min-h-[330px] flex-1">
        <div
          aria-hidden
          className="absolute inset-0 rounded-card border border-line bg-surface"
          style={{ transform: "translateY(16px) scale(.93)" }}
        />
        <motion.div
          key={`${q.id}-${rise}`}
          role="group"
          aria-label={t("aria", { n: qi + 1, total, text: q.text })}
          drag={reduced || finishing ? false : "x"}
          dragSnapToOrigin={false}
          dragElastic={1}
          dragMomentum={false}
          onDragEnd={onDragEnd}
          initial={rise && !reduced ? { scale: 0.96, y: 10, opacity: 0 } : false}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.32, ease: RETURN_EASE }}
          style={{ x, rotate, opacity, touchAction: "pan-y", willChange: "transform" }}
          className="absolute inset-0 box-border flex cursor-grab flex-col justify-between rounded-card border border-line bg-surface-raised p-6 shadow-[0_24px_40px_-28px_var(--shadow)] select-none active:cursor-grabbing"
        >
          <motion.span
            aria-hidden
            style={{ opacity: yesOpacity, rotate: -10 }}
            className="pointer-events-none absolute top-[18px] left-[18px] rounded-pill border-4 border-sticker-edge bg-accent px-3.5 py-2 font-display text-[22px] leading-none font-extrabold text-on-accent shadow-[0_0_0_1.5px_var(--sticker-ring)]"
          >
            {t("stampYes")}
          </motion.span>
          <motion.span
            aria-hidden
            style={{ opacity: noOpacity, rotate: 9 }}
            className="pointer-events-none absolute top-[18px] right-[18px] rounded-pill border-4 border-sticker-edge bg-inverse px-3.5 py-2 font-display text-[22px] leading-none font-extrabold text-on-inverse shadow-[0_0_0_1.5px_var(--sticker-ring)]"
          >
            {t("stampNo")}
          </motion.span>
          <div className="grid gap-3">
            <span className="text-[15px] leading-none font-semibold text-text-muted">
              {t("haveYouEver")}
            </span>
            <span className="font-display text-question leading-[1.05] font-extrabold tracking-[-.02em] text-pretty">
              {q.text}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[13px] leading-none font-medium text-text-muted">
            <span>{t("code", { n: qi + 1 })}</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <HandSwipeRightIcon size={18} aria-hidden />
              {t("swipe")}
            </span>
          </div>
        </motion.div>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => answer("no")}
          aria-disabled={finishing || undefined}
          className={`${ANS} border-text bg-transparent text-text`}
        >
          {t("no")}
        </button>
        <button
          type="button"
          onClick={() => answer("yes")}
          aria-disabled={finishing || undefined}
          className={`${ANS} border-accent bg-accent text-on-accent`}
        >
          {t("yes")}
        </button>
      </div>
      <div className="flex min-h-[22px] items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[14px] leading-[1.3] font-medium text-text-muted">
          <LockSimpleIcon size={16} aria-hidden className="shrink-0" />
          {t("fixHint")}
        </span>
        {(preview?.saving ?? (saving || offline)) && (
          <span
            role="status"
            className="flex items-center gap-1.5 font-mono text-[13px] leading-none font-medium whitespace-nowrap text-text-muted"
          >
            <Spinner />
            {(preview?.offline ?? offline) ? t("queued") : t("saving")}
          </span>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {answered}/{total}
      </span>

      <Sheet
        open={report}
        onOpenChange={setReport}
        title={tr("title")}
        description={`${t("haveYouEver")} ${q.text}`}
      >
        <div className="grid gap-2">
          {(["tooPersonal", "offensive", "typo", "notForGroup"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={async () => {
                setReport(false);
                try {
                  await api("POST", "/reports", {
                    type: "question",
                    questionId: q.id,
                    roomCode: state.room.code,
                    reason: tr(k),
                  });
                  toast(tt("reported"));
                } catch {
                  toast(tt("somethingWrong"), "err");
                }
              }}
              className="h-[52px] rounded-input border border-line bg-surface px-[18px] text-left text-[16px] leading-none font-semibold text-text hover:border-text active:scale-[.98]"
            >
              {tr(k)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setReport(false)}
          className="h-[52px] rounded-pill border-0 bg-transparent text-[16px] leading-none font-semibold text-text hover:bg-surface-raised"
        >
          {c("cancel")}
        </button>
      </Sheet>
    </div>
  );
}
