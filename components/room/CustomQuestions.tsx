"use client";

import { XIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { api, ClientApiError } from "@/lib/api/client";
import type { RoomState } from "@/lib/api/types";

const MAX = 30;
const MIN_TO_PLAY = 5;

/**
 * Custom packs (Batch 3): the host of an 18+ room writes their own "Have you ever" questions. Each
 * one goes through the text filter; they are seen only by this room and can be reported.
 */
export function CustomQuestions({ code }: { code: string }) {
  const t = useTranslations("lobby");
  const tq = useTranslations("question");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useQuery({
    queryKey: ["custom", code],
    queryFn: () => api<Array<{ id: string; text: string }>>("GET", `/rooms/${code}/custom`),
    enabled: open,
  });
  const questions = list.data ?? [];

  const fail = (e: unknown) => {
    const c = e instanceof ClientApiError ? e.code : "";
    toast(
      c === "TEXT_BLOCKED"
        ? tt("textBlocked")
        : c === "TEXT_CONTACT"
          ? tt("textContact")
          : c === "CUSTOM_ADULTS_ONLY"
            ? tt("customAdultsOnly")
            : c === "BAD_REQUEST" && e instanceof ClientApiError
              ? e.message
              : tt("somethingWrong"),
      "err",
    );
  };
  const add = async () => {
    if (busy || !draft.trim()) return;
    setBusy(true);
    try {
      const next = await api<Array<{ id: string; text: string }>>("POST", `/rooms/${code}/custom`, {
        text: draft.trim(),
      });
      qc.setQueryData(["custom", code], next);
      setDraft("");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      const next = await api<Array<{ id: string; text: string }>>(
        "DELETE",
        `/rooms/${code}/custom/${id}`,
      );
      qc.setQueryData(["custom", code], next);
    } catch (e) {
      fail(e);
    }
  };
  const play = async () => {
    setBusy(true);
    try {
      const next = await api<RoomState>("POST", `/rooms/${code}/custom/use`);
      qc.setQueryData(["room", code], next);
      toast(tt("customPlaying"));
      setOpen(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="md" onClick={() => setOpen(true)}>
        {t("customOpen")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("customTitle")}
        description={t("customBody")}
      >
        <div className="grid gap-2">
          <label htmlFor="custom-q" className="text-[15px] leading-none font-semibold">
            {tq("haveYouEver")}
          </label>
          <div className="flex gap-2">
            <input
              id="custom-q"
              value={draft}
              maxLength={120}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              className="box-border h-12 min-w-0 flex-1 rounded-input border border-line bg-surface-raised px-3.5 text-[16px] text-text outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
            />
            <Button
              size="md"
              softDisabled={!draft.trim() || questions.length >= MAX}
              loading={busy}
              onClick={add}
            >
              {t("customAdd")}
            </Button>
          </div>
          <span className="font-mono text-[13px] leading-none text-text-muted">
            {t("customCount", { n: questions.length, max: MAX })}
          </span>
        </div>
        <ul className="m-0 grid max-h-[40dvh] list-none gap-2 overflow-y-auto p-0">
          {questions.map((q) => (
            <li
              key={q.id}
              className="flex items-center gap-2 rounded-input border border-line px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1 text-[15px] leading-[1.35]">
                {tq("haveYouEver")} {q.text}
              </span>
              <button
                type="button"
                aria-label={t("customRemove", { text: q.text })}
                onClick={() => remove(q.id)}
                className="grid size-11 shrink-0 place-items-center rounded-pill border-0 bg-transparent text-text-muted hover:bg-surface-raised hover:text-text"
              >
                <XIcon size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <Button
          softDisabled={questions.length < MIN_TO_PLAY}
          loading={busy}
          onClick={() => questions.length >= MIN_TO_PLAY && play()}
        >
          {questions.length < MIN_TO_PLAY
            ? t("customNeedMore", { n: MIN_TO_PLAY - questions.length })
            : t("customPlay", { n: questions.length })}
        </Button>
      </Sheet>
    </>
  );
}
