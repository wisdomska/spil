"use client";

import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PourProgress } from "@/components/brand/PourProgress";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ClientApiError } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";
import { MAX_TEXT } from "@/lib/moderation/filter";

type Props = {
  state: RoomState;
  onDone: () => Promise<unknown>;
};

/**
 * Who Said That? (18+): write a short answer to each prompt. The server filters every answer;
 * names are revealed at the end, which the screen says up front. Locking the last one submits.
 */
export function WriteView({ state, onDone }: Props) {
  const t = useTranslations("question");
  const tg = useTranslations("guess");
  const tt = useTranslations("toast");
  const toast = useToast();
  const questions = state.questions ?? [];
  const total = questions.length;
  const [texts, setTexts] = useState<Record<string, string>>(() => ({ ...(state.myTexts ?? {}) }));
  const [qi, setQi] = useState(() =>
    Math.max(
      0,
      questions.findIndex((q) => !(q.id in texts)),
    ),
  );
  const q = questions[Math.min(qi, total - 1)];
  const [draft, setDraft] = useState(() => (q ? (texts[q.id] ?? "") : ""));
  const [busy, setBusy] = useState(false);
  if (!q) return null;

  const goTo = (i: number, from: Record<string, string>) => {
    setQi(i);
    setDraft(from[questions[i]!.id] ?? "");
  };

  const lock = async () => {
    const body = draft.trim();
    if (busy || !body) return;
    setBusy(true);
    try {
      const res = await api<{ saved: Record<string, string> }>(
        "PUT",
        `/rooms/${state.room.code}/texts`,
        {
          texts: [{ questionId: q.id, body }],
        },
      );
      const next = { ...texts, ...res.saved };
      setTexts(next);
      const open = questions.findIndex((x) => !(x.id in next));
      if (open >= 0) goTo(open, next);
      else await onDone();
    } catch (e) {
      const code = e instanceof ClientApiError ? e.code : "";
      toast(
        code === "TEXT_BLOCKED"
          ? tt("textBlocked")
          : code === "TEXT_CONTACT"
            ? tt("textContact")
            : code === "TEXT_EMPTY"
              ? tt("textEmpty")
              : tt("somethingWrong"),
        "err",
      );
    } finally {
      setBusy(false);
    }
  };

  const done = Object.keys(texts).filter((id) => questions.some((x) => x.id === id)).length;
  const id = `write-${q.id}`;

  return (
    <div className="flex flex-1 flex-col gap-[18px] xl:mx-auto xl:w-full xl:max-w-[720px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("previousPrompt")}
          onClick={() => qi > 0 && goTo(qi - 1, texts)}
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
          {t("writeAsk")}
        </span>
        <h1 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance">
          {q.text}
        </h1>
        <p className="m-0 text-[14px] leading-[1.4] text-text-muted">{t("writeHint")}</p>
      </div>
      <div className="grid gap-2">
        <label htmlFor={id} className="text-[15px] leading-none font-semibold">
          {t("writeLabel")}
        </label>
        <textarea
          id={id}
          value={draft}
          maxLength={MAX_TEXT}
          rows={4}
          onChange={(e) => setDraft(e.target.value)}
          className="box-border w-full resize-none rounded-card border border-line bg-surface p-4 text-[17px] leading-[1.4] text-text outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
        />
        <span className="text-right font-mono text-[13px] leading-none text-text-muted tabular-nums">
          {t("writeCount", { n: draft.length, max: MAX_TEXT })}
        </span>
      </div>
      <div className="sticky bottom-0 z-[5] -mx-5 mt-auto border-t border-line bg-surface/90 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <Button block softDisabled={!draft.trim()} loading={busy} onClick={lock}>
          {tg("lock")}
        </Button>
      </div>
    </div>
  );
}
