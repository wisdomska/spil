"use client";

import { ArrowClockwiseIcon, HourglassMediumIcon, ShareFatIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/brand/Avatar";
import {
  AWARD_KEY,
  AwardBadge,
  labelStickerStyle,
  stickerRot,
  type LabelName,
} from "@/components/brand/Stickers";
import { Vessel } from "@/components/brand/Vessel";
import { labelKeyFor } from "@/components/game/RevealStage";
import { ShareSheet } from "@/components/game/ShareSheet";
import { SegmentedTabs, TabPanel } from "@/components/ui/SegmentedTabs";
import { SwitchRow } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import type { RoomState } from "@/lib/api/types";
import { labelById } from "@/lib/game";
import { saveLastGame } from "@/lib/share/capture";

type Props = {
  state: RoomState;
  onSpill: (on: boolean) => void;
  onHideName: (hide: boolean) => void;
  /** Dev fixtures only. */
  initialTab?: "scores" | "awards" | "questions";
  initialShare?: boolean;
};

type Tab = "scores" | "awards" | "questions";

export function ResultsView({
  state,
  onSpill,
  onHideName,
  initialTab = "scores",
  initialShare = false,
}: Props) {
  const t = useTranslations("results");
  const tl = useTranslations("labels");
  const ta = useTranslations("awards");
  const tt = useTranslations("toast");
  const tq = useTranslations("question");
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [share, setShare] = useState(initialShare);
  const results = state.results;
  const host = state.players.find((p) => p.isHost);

  const rows = results?.rows ?? [];
  const meRow = rows.find((r) => r.playerId === state.me.id);
  const myAward = results?.awards.find((a) => a.playerId === state.me.id);
  const board = rows.map((r) => ({
    rank: r.rank,
    name: r.nickname,
    avatar: r.avatar,
    score: r.score,
  }));
  const mind = results?.awards.find((a) => a.award === "mind_reader");
  const mindName = rows.find((r) => r.playerId === mind?.playerId)?.nickname;

  // Keep this game's card on the device so the landing page can offer it again.
  useEffect(() => {
    if (!meRow) return;
    saveLastGame({
      room: state.room.code,
      at: Date.now(),
      name: state.me.nickname,
      avatar: state.me.avatar,
      score: meRow.score,
      award: myAward?.award ?? "",
      board,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.room.code, state.room.round, meRow?.score]);

  if (!results) return null;
  const score = meRow?.score ?? 0;
  const guess = meRow?.avgGuessAbout ?? 0;
  const gap = Math.abs(score - guess);
  const verdict = gap <= 10 ? t("verdictWell") : gap <= 25 ? t("verdictLittle") : t("verdictNone");
  const myLabel = meRow ? tl(labelKeyFor(meRow.label)) : "";

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid grid-cols-[minmax(0,1fr)_108px] items-end gap-[18px]">
        <div className="grid gap-2.5">
          <h1 className="m-0 font-display text-[36px] leading-[.98] font-extrabold tracking-display text-balance">
            {t("headline")}{" "}
            <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
              {myLabel}.
            </span>
          </h1>
          <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
            {t("line", { score, guess, verdict })}
          </p>
        </div>
        <div className="relative">
          <Vessel level={score} num={score} height={136} fontSize={56} radius={18} />
          <span
            className="absolute bottom-[-12px] left-[-14px] inline-flex rounded-pill border-[3px] border-sticker-edge bg-accent px-2.5 py-[7px] font-display text-[13px] leading-none font-extrabold whitespace-nowrap text-on-accent"
            style={{
              boxShadow: "0 0 0 1.5px var(--sticker-ring)",
              fontStretch: "80%",
              rotate: "-4deg",
            }}
          >
            {myLabel}
          </span>
        </div>
      </div>

      <SegmentedTabs
        label={t("tabs")}
        value={tab}
        onValueChange={setTab}
        className="mt-1.5"
        items={[
          { value: "scores", label: t("scores") },
          { value: "awards", label: t("awards") },
          { value: "questions", label: t("questions") },
        ]}
      >
        <TabPanel value="scores" className="outline-none">
          <ol className="m-0 grid list-none p-0">
            {rows.map((r, i) => (
              <li
                key={r.playerId}
                className="-mx-2.5 flex items-center gap-3 rounded-input border-b border-line px-2.5 py-3"
                style={{
                  background: r.playerId === state.me.id ? "var(--accent-soft)" : "transparent",
                }}
              >
                <span className="w-[18px] font-mono text-[14px] leading-none font-medium text-text-muted">
                  {r.rank}
                </span>
                <Avatar n={r.avatar} size={44} label={r.nickname} />
                <div className="grid min-w-0 flex-1 gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-[19px] leading-none font-bold">
                      {r.nickname}
                    </span>
                    <span
                      style={labelStickerStyle(
                        labelById(r.label).name as LabelName,
                        stickerRot(i) * 0.6,
                        12,
                      )}
                    >
                      {tl(labelKeyFor(r.label))}
                    </span>
                  </div>
                  <span className="font-mono text-[12.5px] leading-[1.2] font-medium text-text-muted">
                    {t("sub", { guess: r.avgGuessAbout, points: r.mindReader })}
                  </span>
                </div>
                <span className="font-mono text-[30px] leading-none font-semibold tabular-nums">
                  {r.score}
                </span>
              </li>
            ))}
          </ol>
        </TabPanel>
        <TabPanel value="awards" className="outline-none">
          <div className="grid gap-[18px]">
            {results.awards.length === 0 && (
              <p className="m-0 text-[15px] leading-[1.45] text-text-muted">{t("awardsNone")}</p>
            )}
            {results.awards.map((a, i) => {
              const who = rows.find((r) => r.playerId === a.playerId);
              return (
                <div
                  key={a.award}
                  className="flex items-center gap-[18px] border-b border-line pt-1.5 pb-3.5"
                >
                  <AwardBadge award={a.award} index={i} />
                  <div className="grid flex-1 gap-1.5">
                    <span className="font-display text-[20px] leading-none font-extrabold">
                      {ta(AWARD_KEY[a.award])}
                    </span>
                    {who && (
                      <span className="flex items-center gap-2 text-[15px] leading-none font-semibold">
                        <Avatar n={who.avatar} size={24} decorative />
                        {who.nickname}
                      </span>
                    )}
                    <span className="text-[14px] leading-[1.4] text-text-muted">{a.reason}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabPanel>
        <TabPanel value="questions" className="outline-none">
          <div className="grid gap-4">
            <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("statsNote")}</p>
            {results.questionStats.length === 0 && (
              <p className="m-0 text-[15px] text-text-muted">{t("statsEmpty")}</p>
            )}
            {results.questionStats.map((q) => (
              <div key={q.questionId} className="grid gap-2 border-b border-line pb-4">
                <span className="font-display text-[18px] leading-[1.2] font-bold">
                  {tq("haveYouEver")} {q.text}
                </span>
                {q.yes === null ? (
                  <span className="font-mono text-[13px] leading-none font-medium text-text-muted">
                    {t("statsHidden")}
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-pill bg-surface-raised">
                      <div
                        className="h-1.5 rounded-pill bg-text"
                        style={{ width: `${q.answered ? (q.yes / q.answered) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-[14px] leading-none font-medium">
                      {t("statsCount", { yes: q.yes, n: q.answered })}
                    </span>
                  </div>
                )}
                <span className="text-[14px] leading-[1.3] font-medium text-text-muted">
                  {q.spillNames.length
                    ? t("spillYes", { names: q.spillNames.join(", ") })
                    : t("spillNobody")}
                </span>
              </div>
            ))}
          </div>
        </TabPanel>
      </SegmentedTabs>

      <SwitchRow
        checked={state.me.spillMode}
        onCheckedChange={(on) => {
          onSpill(on);
          toast(on ? tt("spillOn") : tt("spillOff"));
        }}
        title={t("spillMode")}
        description={state.me.spillMode ? t("spillOnCopy") : t("spillOffCopy")}
      />

      <div className="flex gap-2.5 pb-2">
        <button
          type="button"
          onClick={() => setShare(true)}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-pill border-[1.5px] border-text bg-transparent text-[17px] leading-none font-semibold text-text hover:bg-surface-raised"
        >
          <ShareFatIcon size={20} aria-hidden />
          {t("share")}
        </button>
        {state.me.isHost ? (
          <Link
            href={`/create?room=${state.room.code}&mode=rematch&pack=${state.room.pack.id}`}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-pill bg-accent text-[17px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent hover:shadow-[inset_0_0_0_99px_var(--press-glow)] active:scale-[.97]"
          >
            <ArrowClockwiseIcon size={20} aria-hidden />
            {t("rematch")}
          </Link>
        ) : (
          <span className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-pill border border-dashed border-line-strong px-3 text-center text-[14px] leading-[1.3] font-medium text-text-muted">
            <HourglassMediumIcon size={18} aria-hidden />
            {t("guestRematch", { host: host?.nickname ?? "" })}
          </span>
        )}
      </div>

      <ShareSheet
        open={share}
        onOpenChange={setShare}
        room={state.room.code}
        pack={state.room.pack.name}
        name={state.me.nickname}
        avatar={state.me.avatar}
        score={score}
        award={myAward?.award ?? "open_book"}
        board={board}
        boardAward={mind && mindName ? { award: "mind_reader", name: mindName } : undefined}
        hideName={state.me.hideNameOnCard}
        onHideName={onHideName}
      />
    </div>
  );
}
