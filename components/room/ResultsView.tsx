"use client";

import { HourglassMediumIcon, TrophyIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
import { Sheet } from "@/components/ui/Sheet";
import { SwitchRow } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { CrewPanel } from "@/components/crews/CrewPanel";
import { api } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import type { RoomState } from "@/lib/api/types";
import { isTiedRank, labelById, rankByGuessing, verdictBand } from "@/lib/game";
import { saveLastGame } from "@/lib/share/capture";

/** Wall-clock time for the saved card (called from an effect, never during render). */
const timestamp = () => Date.now();

type Props = {
  state: RoomState;
  onSpill: (on: boolean) => void;
  onHideName: (hide: boolean) => void;
  /** SPIL-18: same pack, same count, one tap. */
  onRematch?: () => void;
  rematching?: boolean;
  onResetSeries?: () => void;
  /** Dev fixtures only. */
  initialTab?: "scores" | "awards" | "questions";
  initialShare?: boolean;
};

type Tab = "scores" | "awards" | "questions" | "duo";

export function ResultsView({
  state,
  onSpill,
  onHideName,
  onRematch,
  rematching,
  onResetSeries,
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
  const [explain, setExplain] = useState(false);
  // SPIL-16: turning Spill Mode on asks first; turning it off never does.
  const [confirmSpill, setConfirmSpill] = useState(false);
  const keepPrivate = useRef<HTMLButtonElement>(null);
  const setSpill = (on: boolean) => {
    onSpill(on);
    toast(on ? tt("spillOn") : tt("spillOff"));
  };
  const results = state.results;
  const host = state.players.find((p) => p.isHost);
  const hot = state.room.mode === "hot_takes";
  const likely = state.room.mode === "most_likely";
  const flags = state.room.mode === "red_green";
  const rank = state.room.mode === "rank_room";
  const imposter = state.room.mode === "imposter";
  const truths = state.room.mode === "two_truths";
  const said = state.room.mode === "who_said";
  // Modes without a Spill Score: no labels, Spill Mode or share card.
  const noSpill = hot || likely || flags || rank || imposter || truths || said;

  const rows = rankByGuessing(results?.rows ?? []);
  const ranks = rows.map((r) => r.rank);
  const rankText = (rank: number) =>
    isTiedRank(rank, ranks) ? t("rankTied", { rank }) : String(rank);
  const meRow = rows.find((r) => r.playerId === state.me.id);
  const myAward = results?.awards.find((a) => a.playerId === state.me.id);
  const board = rows.map((r) => ({
    rank: r.rank,
    rankLabel: rankText(r.rank),
    name: r.nickname,
    avatar: r.avatar,
    score: r.score,
    points: r.mindReader,
  }));
  const winners = rows.filter((r) => r.rank === 1 && r.mindReader > 0);
  const mind = results?.awards.find((a) => a.award === "mind_reader");
  const mindName = rows.find((r) => r.playerId === mind?.playerId)?.nickname;

  // Keep this game's card on the device so the landing page can offer it again.
  useEffect(() => {
    // The saved card is about a Spill Score, which Hot Takes does not have.
    if (!meRow || noSpill) return;
    saveLastGame({
      room: state.room.code,
      at: timestamp(),
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
  // Solo: nobody guessed, so there is no room guess, no points and no winner (cascade).
  const pct = state.room.mode !== "classic" && state.room.mode !== "spill_or_skip";
  const solo = (meRow?.guessedBy ?? 0) === 0;
  // SPIL-23: two scored players see Scores and Duo; room awards and question counts need 3.
  const duoRoom = !pct && rows.length === 2;
  const duo = results.duo;
  // Room Percentage: nobody guesses about players; the points are for reading the room.
  const anyGuesses =
    state.room.mode === "who_said"
      ? Object.values(results.spotted ?? {}).some((s) => s.total > 0)
      : state.room.mode === "two_truths"
        ? (results.cards ?? []).some((c) => c.guessers > 0)
        : state.room.mode === "imposter"
          ? (results.imposter?.voters ?? 0) > 0
          : state.room.mode === "rank_room"
            ? (results.ranked ?? []).length > 0
            : state.room.mode === "red_green"
              ? (results.flags ?? []).length > 0
              : state.room.mode === "most_likely"
                ? (results.likely ?? []).length > 0
                : pct
                  ? (results.percent ?? []).some((q) => q.guesses.length > 0)
                  : rows.some((r) => (r.guessedBy ?? 0) > 0);
  const band = verdictBand(gap);
  const verdict =
    band === "well" ? t("verdictWell") : band === "little" ? t("verdictLittle") : t("verdictNone");
  const myLabel = meRow ? tl(labelKeyFor(meRow.label)) : "";

  return (
    <div className="flex flex-col gap-[22px]">
      {said ? (
        <WhoHeader spotted={results.spotted?.[state.me.id]} points={meRow?.mindReader ?? 0} />
      ) : truths ? (
        <CardHeader
          card={results.cards?.find((c) => c.playerId === state.me.id)}
          points={meRow?.mindReader ?? 0}
        />
      ) : imposter && results.imposter ? (
        <ImposterHeader
          outcome={results.imposter}
          meId={state.me.id}
          points={meRow?.mindReader ?? 0}
          name={(id) => rows.find((r) => r.playerId === id)?.nickname ?? ""}
        />
      ) : rank ? (
        <BestHeader
          best={results.best?.[state.me.id]}
          points={meRow?.mindReader ?? 0}
          anyGuesses={anyGuesses}
        />
      ) : flags ? (
        <LoneHeader
          lone={results.lone?.[state.me.id]}
          points={meRow?.mindReader ?? 0}
          anyGuesses={anyGuesses}
        />
      ) : likely ? (
        <CrownedHeader
          crowned={results.crowned?.[state.me.id]}
          points={meRow?.mindReader ?? 0}
          anyGuesses={anyGuesses}
        />
      ) : hot ? (
        <HotTakeHeader
          take={results.hottest?.[state.me.id]}
          points={meRow?.mindReader ?? 0}
          anyGuesses={anyGuesses}
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_108px] items-end gap-[18px]">
          <div className="grid gap-2.5">
            <h1 className="m-0 font-display text-[36px] leading-[.98] font-extrabold tracking-display text-balance">
              {t.rich("headline", {
                label: meRow ? labelKeyFor(meRow.label) : "menace",
                em: (chunks) => (
                  <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
                    {chunks}
                  </span>
                ),
              })}
            </h1>
            <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
              {pct
                ? anyGuesses
                  ? t("linePercent", { score, points: meRow?.mindReader ?? 0 })
                  : t("lineSolo", { score })
                : solo
                  ? t("lineSolo", { score })
                  : t("line", { score, guess, verdict })}
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
      )}

      {anyGuesses && winners.length > 0 && (
        <p className="m-0 flex items-center gap-2.5 rounded-card border border-line bg-surface px-4 py-3 text-[15px] leading-[1.4] font-semibold">
          <TrophyIcon aria-hidden size={20} className="shrink-0 text-accent-ink" />
          {winners.length > 1
            ? t("winnerTie", {
                names: winners.map((w) => w.nickname).join(", "),
                points: winners[0]!.mindReader,
              })
            : winners[0]!.playerId === state.me.id
              ? t("winnerYou", { points: winners[0]!.mindReader })
              : t("winner", { name: winners[0]!.nickname, points: winners[0]!.mindReader })}
        </p>
      )}

      {state.room.mode === "spill_or_skip" && results.spill && (
        <SpillPanel
          spill={results.spill}
          meId={state.me.id}
          code={state.room.code}
          name={(id) => rows.find((r) => r.playerId === id)?.nickname ?? ""}
        />
      )}

      {state.series && (
        <SeriesStrip series={state.series} onReset={state.me.isHost ? onResetSeries : undefined} />
      )}

      <SegmentedTabs
        label={t("tabs")}
        value={tab}
        onValueChange={setTab}
        className="mt-1.5"
        items={
          duoRoom
            ? [
                { value: "scores", label: t("scores") },
                ...(duo ? [{ value: "duo" as const, label: t("duo") }] : []),
              ]
            : [
                { value: "scores", label: t("scores") },
                { value: "awards", label: t("awards") },
                { value: "questions", label: t("questions") },
              ]
        }
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
                <span className="min-w-[18px] font-mono text-[14px] leading-none font-medium whitespace-nowrap text-text-muted">
                  {rankText(r.rank)}
                </span>
                <span className="relative shrink-0">
                  <Avatar
                    n={r.avatar}
                    size={40}
                    label={r.nickname}
                    frame={state.players.find((p) => p.id === r.playerId)?.frame}
                  />
                  {(r.bullseyes ?? 0) > 0 && (
                    <span
                      className="absolute -right-3 -bottom-2 rounded-pill border-2 border-sticker-edge bg-accent px-1.5 py-0.5 font-display text-[10px] leading-none font-extrabold whitespace-nowrap text-on-accent uppercase"
                      style={{ boxShadow: "0 0 0 1px var(--sticker-ring)", rotate: "-6deg" }}
                    >
                      {t("bullseye")}
                    </span>
                  )}
                </span>
                <div className="grid min-w-0 flex-1 gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-[19px] leading-none font-bold">
                      {r.nickname}
                    </span>
                    {!noSpill && (
                      <span
                        style={labelStickerStyle(
                          labelById(r.label).name as LabelName,
                          stickerRot(i) * 0.6,
                          12,
                        )}
                      >
                        {tl(labelKeyFor(r.label))}
                      </span>
                    )}
                  </div>
                  {!noSpill && (
                    <span className="font-mono text-[13px] leading-[1.2] font-medium text-text-muted">
                      {!pct && (r.guessedBy ?? 0) > 0
                        ? t("sub", { score: r.score, guess: r.avgGuessAbout })
                        : t("subSolo", { score: r.score })}
                    </span>
                  )}
                </div>
                {anyGuesses && (
                  <span className="grid justify-items-end gap-1">
                    <span className="font-mono text-[30px] leading-none font-semibold tabular-nums">
                      {r.mindReader}
                    </span>
                    <span className="font-mono text-[11px] leading-none font-medium tracking-wide whitespace-nowrap text-text-muted uppercase">
                      {t("pts")}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ol>
          {anyGuesses && !likely && !flags && !rank && !imposter && !truths && !said && (
            <button
              type="button"
              onClick={() => setExplain(true)}
              className="mt-3 -ml-2.5 flex h-11 items-center gap-1.5 rounded-pill border-0 bg-transparent pr-3.5 pl-2.5 text-[14px] leading-none font-semibold text-accent-ink hover:bg-surface-raised"
            >
              {t("howPoints")}
            </button>
          )}
        </TabPanel>
        {duoRoom && duo && (
          <TabPanel value="duo" className="outline-none">
            <DuoPanel duo={duo} rows={results.rows} />
          </TabPanel>
        )}
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
          {said ? (
            <SaidStats said={results.said ?? []} rows={rows} code={state.room.code} />
          ) : truths ? (
            <CardStats cards={results.cards ?? []} rows={rows} />
          ) : imposter && results.imposter ? (
            <ImposterStats outcome={results.imposter} rows={rows} />
          ) : rank ? (
            <RankStats ranked={results.ranked ?? []} rows={rows} />
          ) : flags ? (
            <FlagStats flags={results.flags ?? []} />
          ) : likely ? (
            <LikelyStats likely={results.likely ?? []} rows={rows} />
          ) : hot ? (
            <HotStats
              percent={results.percent ?? []}
              note={t("hotStatsNote")}
              empty={t("statsEmpty")}
              count={(n, count) => t("hotStatsCount", { n, count })}
            />
          ) : (
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
          )}
        </TabPanel>
      </SegmentedTabs>

      <CrewPanel state={state} />

      <Sheet
        open={confirmSpill}
        onOpenChange={setConfirmSpill}
        title={t("spillConfirmTitle")}
        description={t("spillConfirmBody")}
        initialFocus={keepPrivate}
      >
        <Button
          onClick={() => {
            setConfirmSpill(false);
            setSpill(true);
          }}
        >
          {t("spillConfirmYes")}
        </Button>
        <Button ref={keepPrivate} variant="secondary" onClick={() => setConfirmSpill(false)}>
          {t("spillConfirmNo")}
        </Button>
      </Sheet>

      {!noSpill && (
        <SwitchRow
          checked={state.me.spillMode}
          onCheckedChange={(on) => (on ? setConfirmSpill(true) : setSpill(false))}
          title={t("spillMode")}
          description={state.me.spillMode ? t("spillOnCopy") : t("spillOffCopy")}
        />
      )}

      <div className="flex gap-2.5 pb-2">
        {!noSpill && (
          <button
            type="button"
            onClick={() => setShare(true)}
            className="flex h-14 min-w-0 flex-1 basis-0 items-center justify-center gap-2 rounded-pill border-[1.5px] border-text bg-transparent text-[17px] leading-none font-semibold text-text hover:bg-surface-raised"
          >
            {t("share")}
          </button>
        )}
        {state.me.isHost ? (
          <Button className="min-w-0 flex-1 basis-0 px-4" loading={rematching} onClick={onRematch}>
            {t("rematch")}
          </Button>
        ) : (
          <span className="flex min-h-14 min-w-0 flex-1 basis-0 items-center justify-center gap-2 rounded-pill border border-dashed border-line-strong px-3 text-center text-[14px] leading-[1.3] font-medium text-text-muted">
            <HourglassMediumIcon size={18} aria-hidden />
            {t("guestRematch", { host: host?.nickname ?? "" })}
          </span>
        )}
      </div>
      {state.me.isHost && (
        <Link
          href={`/create?room=${state.room.code}&mode=rematch&current=${state.room.mode}&pack=${state.room.pack.id}`}
          className="-mt-3 w-fit self-center text-[15px] leading-[1.4] font-semibold text-text-muted underline underline-offset-4 hover:text-text"
        >
          {t("changeGame")}
        </Link>
      )}

      <ShareSheet
        open={share}
        onOpenChange={setShare}
        room={state.room.code}
        pack={state.room.pack.name}
        name={state.me.nickname}
        avatar={state.me.avatar}
        look={state.me.look}
        score={score}
        award={myAward?.award}
        board={board}
        duo={
          duoRoom && duo
            ? {
                pct: duo.pct,
                award: t(`duoAwards.${duo.award}.name`),
                players: results.rows.map((r) => ({
                  name: r.nickname,
                  avatar: r.avatar,
                  score: r.score,
                })),
              }
            : undefined
        }
        boardAward={mind && mindName ? { award: "mind_reader", name: mindName } : undefined}
        hideName={state.me.hideNameOnCard}
        onHideName={onHideName}
      />
      <Sheet open={explain} onOpenChange={setExplain} title={t("howPoints")}>
        <table className="w-full border-collapse text-[15px] leading-[1.4]">
          <tbody>
            {[
              [t("pointsExact"), "10"],
              [t("pointsWithin", { n: 5 }), "7"],
              [t("pointsWithin", { n: 10 }), "5"],
              [t("pointsWithin", { n: 20 }), "2"],
              [t("pointsMore", { n: 20 }), "0"],
              [t("pointsClosest"), "+3"],
            ].map(([label, points]) => (
              <tr key={label} className="border-b border-line">
                <th scope="row" className="py-2.5 text-left font-semibold">
                  {label}
                </th>
                <td className="py-2.5 text-right font-mono font-semibold tabular-nums">{points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 text-[14px] leading-[1.45] text-text-muted">
          {pct ? t("pointsNotePercent") : t("pointsNote")}
        </p>
      </Sheet>
    </div>
  );
}

/** Hot Takes: the statement you sat furthest from the room on, and your points. */
function HotTakeHeader({
  take,
  points,
  anyGuesses,
}: {
  take: { text: string; rating: number; average: number } | undefined;
  points: number;
  anyGuesses: boolean;
}) {
  const t = useTranslations("results");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_108px] items-end gap-[18px]">
      <div className="grid gap-2.5">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("hottestKicker")}
        </span>
        <h1 className="m-0 font-display text-[30px] leading-[1.02] font-extrabold tracking-display text-balance">
          {take ? take.text : t("hottestNone")}
        </h1>
        <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
          {take && t("hottestLine", { rating: take.rating, average: take.average })}{" "}
          {anyGuesses && t("hotPoints", { points })}
        </p>
      </div>
      {take && (
        <Vessel level={take.rating} num={take.rating} height={136} fontSize={56} radius={18} />
      )}
    </div>
  );
}

/** Hot Takes questions tab: each statement's average, never anyone's own rating. */
function HotStats({
  percent,
  note,
  empty,
  count,
}: {
  percent: Array<{ questionId: string; text: string; actual: number; answered: number }>;
  note: string;
  empty: string;
  count: (n: number, count: number) => string;
}) {
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{note}</p>
      {percent.length === 0 && <p className="m-0 text-[15px] text-text-muted">{empty}</p>}
      {percent.map((q) => (
        <div key={q.questionId} className="grid gap-2 border-b border-line pb-4">
          <span className="font-display text-[18px] leading-[1.2] font-bold">{q.text}</span>
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-pill bg-surface-raised">
              <div className="h-1.5 rounded-pill bg-text" style={{ width: `${q.actual}%` }} />
            </div>
            <span className="font-mono text-[14px] leading-none font-medium">
              {count(q.actual, q.answered)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Most Likely To: the prompt the room picked you for most strongly, and your points. */
function CrownedHeader({
  crowned,
  points,
  anyGuesses,
}: {
  crowned: { text: string; count: number; voters: number } | undefined;
  points: number;
  anyGuesses: boolean;
}) {
  const t = useTranslations("results");
  const share = crowned ? Math.round((crowned.count / Math.max(1, crowned.voters)) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_108px] items-end gap-[18px]">
      <div className="grid gap-2.5">
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("crownedKicker")}
        </span>
        <h1 className="m-0 font-display text-[30px] leading-[1.02] font-extrabold tracking-display text-balance">
          {crowned ? crowned.text : t("crownedNone")}
        </h1>
        <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
          {crowned && t("crownedLine", { count: crowned.count, total: crowned.voters })}{" "}
          {anyGuesses && t("likelyPoints", { points })}
        </p>
      </div>
      {crowned && <Vessel level={share} num={`${share}%`} height={136} fontSize={44} radius={18} />}
    </div>
  );
}

/** Most Likely To questions tab: each prompt's pick and counts, never who voted for whom. */
function LikelyStats({
  likely,
  rows,
}: {
  likely: Array<{
    questionId: string;
    text: string;
    voters: number;
    top: string[];
    tally: Array<{ playerId: string; count: number }>;
  }>;
  rows: Array<{ playerId: string; nickname: string }>;
}) {
  const t = useTranslations("results");
  const tq = useTranslations("question");
  const name = (id: string) => rows.find((r) => r.playerId === id)?.nickname ?? "";
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("likelyStatsNote")}</p>
      {likely.length === 0 && <p className="m-0 text-[15px] text-text-muted">{t("statsEmpty")}</p>}
      {likely.map((q) => {
        const most = q.tally[0]?.count ?? 0;
        return (
          <div key={q.questionId} className="grid gap-2 border-b border-line pb-4">
            <span className="font-display text-[18px] leading-[1.2] font-bold">
              {tq("likelyPrefix")} {q.text}
            </span>
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-pill bg-surface-raised">
                <div
                  className="h-1.5 rounded-pill bg-text"
                  style={{ width: `${(most / Math.max(1, q.voters)) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-[14px] leading-[1.3] font-medium text-text-muted">
              {t("likelyStatsPick", {
                names: q.top.map(name).join(", "),
                count: most,
                total: q.voters,
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Red Flag, Green Flag: the scenario you were most outnumbered on (only you see it). */
function LoneHeader({
  lone,
  points,
  anyGuesses,
}: {
  lone: { text: string; side: "green" | "red"; against: number } | undefined;
  points: number;
  anyGuesses: boolean;
}) {
  const t = useTranslations("results");
  const side = (s: "green" | "red") => (s === "green" ? t("sideGreen") : t("sideRed"));
  return (
    <div className="grid gap-2.5">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {t("loneKicker")}
      </span>
      <h1 className="m-0 font-display text-[30px] leading-[1.02] font-extrabold tracking-display text-balance">
        {lone ? lone.text : t("loneNone")}
      </h1>
      <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
        {lone &&
          t("loneLine", {
            side: side(lone.side),
            against: lone.against,
            other: side(lone.side === "green" ? "red" : "green"),
          })}{" "}
        {anyGuesses && t("flagPoints", { points })}
      </p>
    </div>
  );
}

/** Red Flag, Green Flag questions tab: each scenario's split, never who swiped what. */
function FlagStats({
  flags,
}: {
  flags: Array<{ questionId: string; text: string; greenShare: number; verdict: string }>;
}) {
  const t = useTranslations("results");
  const tr = useTranslations("reveal");
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("flagStatsNote")}</p>
      {flags.length === 0 && <p className="m-0 text-[15px] text-text-muted">{t("statsEmpty")}</p>}
      {flags.map((f) => (
        <div key={f.questionId} className="grid gap-2 border-b border-line pb-4">
          <span className="font-display text-[18px] leading-[1.2] font-bold">{f.text}</span>
          <div className="h-1.5 rounded-pill bg-surface-raised">
            <div className="h-1.5 rounded-pill bg-text" style={{ width: `${f.greenShare}%` }} />
          </div>
          <span className="font-mono text-[14px] leading-none font-medium text-text-muted">
            {tr("flagSplitLine", { green: f.greenShare, red: 100 - f.greenShare })}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Rank the Room: the prompt the room placed you highest on, and your points. */
function BestHeader({
  best,
  points,
  anyGuesses,
}: {
  best: { text: string; place: number } | undefined;
  points: number;
  anyGuesses: boolean;
}) {
  const t = useTranslations("results");
  return (
    <div className="grid gap-2.5">
      {best && (
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("bestKicker", { place: best.place })}
        </span>
      )}
      <h1 className="m-0 font-display text-[30px] leading-[1.02] font-extrabold tracking-display text-balance">
        {best ? best.text : t("bestNone")}
      </h1>
      {anyGuesses && (
        <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
          {t("rankPoints", { points })}
        </p>
      )}
    </div>
  );
}

/** Rank the Room questions tab: the room's order per prompt, never anyone's ranking. */
function RankStats({
  ranked,
  rows,
}: {
  ranked: Array<{
    questionId: string;
    text: string;
    order: Array<{ playerId: string; place: number }>;
  }>;
  rows: Array<{ playerId: string; nickname: string }>;
}) {
  const t = useTranslations("results");
  const tq = useTranslations("question");
  const name = (id: string) => rows.find((r) => r.playerId === id)?.nickname ?? "";
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("rankStatsNote")}</p>
      {ranked.length === 0 && <p className="m-0 text-[15px] text-text-muted">{t("statsEmpty")}</p>}
      {ranked.map((q) => (
        <div key={q.questionId} className="grid gap-2 border-b border-line pb-4">
          <span className="font-display text-[18px] leading-[1.2] font-bold">
            {tq("likelyPrefix")} {q.text}
          </span>
          <ol className="m-0 grid list-none gap-1 p-0">
            {q.order.map((p) => (
              <li key={p.playerId} className="flex gap-2.5 text-[15px] leading-[1.3] font-medium">
                <span className="w-6 font-mono text-text-muted tabular-nums">{p.place}</span>
                {name(p.playerId)}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** Imposter: who it was, whether the room caught them, and what that meant for you. */
function ImposterHeader({
  outcome,
  meId,
  points,
  name,
}: {
  outcome: { imposterId: string | null; caught: boolean };
  meId: string;
  points: number;
  name: (id: string) => string;
}) {
  const t = useTranslations("results");
  const you = outcome.imposterId === meId;
  return (
    <div className="grid gap-2.5">
      <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
        {you ? t("imposterKickerYou") : t("imposterKicker")}
      </span>
      {you && (
        <h1 className="m-0 font-display text-[36px] leading-[1] font-extrabold tracking-display">
          {outcome.caught ? t("caughtTitle") : t("escapedTitle")}
        </h1>
      )}
      {!you && outcome.imposterId && (
        <h1 className="m-0 font-display text-[36px] leading-[1] font-extrabold tracking-display">
          {name(outcome.imposterId)}
        </h1>
      )}
      <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
        {you
          ? outcome.caught
            ? t("imposterCaughtYou")
            : t("imposterEscapedYou", { points })
          : outcome.caught
            ? t("imposterCaught")
            : t("imposterEscaped")}{" "}
        {!you && points > 0 && t("rightVote", { points })}
      </p>
    </div>
  );
}

/** Imposter questions tab: each question, the imposter's version, and everyone's numbers. */
function ImposterStats({
  outcome,
  rows,
}: {
  outcome: {
    board: Array<{
      questionId: string;
      text: string;
      altText: string;
      answers: Array<{ playerId: string; value: number }>;
    }>;
  };
  rows: Array<{ playerId: string; nickname: string }>;
}) {
  const t = useTranslations("results");
  const name = (id: string) => rows.find((r) => r.playerId === id)?.nickname ?? "";
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("imposterStatsNote")}</p>
      {outcome.board.map((b) => (
        <div key={b.questionId} className="grid gap-2 border-b border-line pb-4">
          <span className="font-display text-[18px] leading-[1.2] font-bold">{b.text}</span>
          <span className="text-[14px] leading-[1.3] font-medium text-text-muted">
            {t("imposterAlt", { text: b.altText })}
          </span>
          <span className="font-mono text-[14px] leading-[1.5] text-text-muted">
            {b.answers.map((a) => `${name(a.playerId)} ${a.value}`).join(", ")}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Two Truths and a Spill: how many your card fooled, and your points. */
function CardHeader({
  card,
  points,
}: {
  card: { guessers: number; fooled: number } | undefined;
  points: number;
}) {
  const t = useTranslations("results");
  return (
    <div className="grid gap-2.5">
      {card && (
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("cardKicker")}
        </span>
      )}
      <h1 className="m-0 font-display text-[36px] leading-[1] font-extrabold tracking-display">
        {card ? t("cardTitle", { fooled: card.fooled, total: card.guessers }) : t("cardNone")}
      </h1>
      <p className="m-0 text-[16px] leading-[1.45] text-text-muted">
        {t("cardPoints", { points })}
      </p>
    </div>
  );
}

/** Two Truths questions tab: each card, its spill, and the picks. Only what players showed. */
function CardStats({
  cards,
  rows,
}: {
  cards: Array<{
    playerId: string;
    spill: string;
    items: Array<{ questionId: string; text: string }>;
    spotted: Record<string, number>;
  }>;
  rows: Array<{ playerId: string; nickname: string }>;
}) {
  const t = useTranslations("results");
  const tr = useTranslations("reveal");
  const tq = useTranslations("question");
  const name = (id: string) => rows.find((r) => r.playerId === id)?.nickname ?? "";
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("cardsStatsNote")}</p>
      {cards.length === 0 && <p className="m-0 text-[15px] text-text-muted">{t("statsEmpty")}</p>}
      {cards.map((c) => (
        <div key={c.playerId} className="grid gap-2 border-b border-line pb-4">
          <span className="font-display text-[18px] leading-[1.2] font-bold">
            {name(c.playerId)}
          </span>
          {c.items.map((i) => (
            <span key={i.questionId} className="text-[15px] leading-[1.35] font-medium">
              <span className="font-semibold">
                {i.questionId === c.spill ? tr("spillStamp") : tr("truthStamp")}:
              </span>{" "}
              {tq("haveYouEver")} {i.text}{" "}
              <span className="font-mono text-[13px] text-text-muted">
                ({tr("picked", { count: c.spotted[i.questionId] ?? 0 })})
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Who Said That?: how many authors you guessed right, and your points. */
function WhoHeader({
  spotted,
  points,
}: {
  spotted: { right: number; total: number } | undefined;
  points: number;
}) {
  const t = useTranslations("results");
  return (
    <div className="grid gap-2.5">
      {spotted && spotted.total > 0 && (
        <span className="font-mono text-[13px] leading-none font-medium tracking-[.06em] text-text-muted">
          {t("whoKicker")}
        </span>
      )}
      <h1 className="m-0 font-display text-[36px] leading-[1] font-extrabold tracking-display">
        {spotted && spotted.total > 0
          ? t("whoTitle", { right: spotted.right, total: spotted.total })
          : t("whoNone")}
      </h1>
      <p className="m-0 text-[16px] leading-[1.45] text-text-muted">{t("whoPoints", { points })}</p>
    </div>
  );
}

/**
 * Who Said That? questions tab: every answer and who wrote it, each with a Report button. A
 * report hides the answer for everyone straight away and reaches the admin console.
 */
function SaidStats({
  said,
  rows,
  code,
}: {
  said: Array<{
    questionId: string;
    text: string;
    answers: Array<{ id: string; playerId: string; body: string; hidden: boolean }>;
  }>;
  rows: Array<{ playerId: string; nickname: string }>;
  code: string;
}) {
  const t = useTranslations("results");
  const tr = useTranslations("reveal");
  const tt = useTranslations("toast");
  const toast = useToast();
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const name = (id: string) => rows.find((r) => r.playerId === id)?.nickname ?? "";
  const report = async (id: string) => {
    try {
      await api("POST", `/rooms/${code}/answers/${id}/report`, {});
      setReported((r) => ({ ...r, [id]: true }));
      toast(tt("answerReported"));
    } catch {
      toast(tt("somethingWrong"), "err");
    }
  };
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">{t("saidStatsNote")}</p>
      {said.length === 0 && <p className="m-0 text-[15px] text-text-muted">{t("statsEmpty")}</p>}
      {said.map((q) => (
        <div key={q.questionId} className="grid gap-2.5 border-b border-line pb-4">
          <span className="font-display text-[18px] leading-[1.2] font-bold">{q.text}</span>
          {q.answers.map((a) => {
            const gone = a.hidden || reported[a.id];
            return (
              <div key={a.id} className="flex items-start gap-3">
                <div className="grid min-w-0 flex-1 gap-1">
                  <span className="text-[15px] leading-[1.35] font-medium">
                    {gone ? <span className="text-text-muted">{tr("hiddenAnswer")}</span> : a.body}
                  </span>
                  <span className="text-[13px] leading-none font-semibold text-text-muted">
                    {name(a.playerId)}
                  </span>
                </div>
                {!gone && (
                  <button
                    type="button"
                    aria-label={t("reportAria", { text: a.body })}
                    onClick={() => report(a.id)}
                    className="h-11 shrink-0 rounded-pill border border-line bg-transparent px-3.5 text-[14px] leading-none font-semibold text-text hover:bg-surface-raised"
                  >
                    {t("report")}
                  </button>
                )}
                {reported[a.id] && (
                  <span className="shrink-0 text-[13px] leading-none font-semibold text-text-muted">
                    {t("reported")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Spill or Skip: vote for one Spill Mode yes to hear the story behind, or skip. Shows the votes
 * as they come in, the room's pick, and lets the picked player tell it or pass.
 */
function SpillPanel({
  spill,
  meId,
  code,
  name,
}: {
  spill: NonNullable<NonNullable<RoomState["results"]>["spill"]>;
  meId: string;
  code: string;
  name: (id: string) => string;
}) {
  const t = useTranslations("results");
  const tt = useTranslations("toast");
  const toast = useToast();
  const qc = useQueryClient();
  const key = (o: { questionId: string; playerId: string }) => `${o.questionId}:${o.playerId}`;
  const mine = spill.myVote === "skip" ? "skip" : spill.myVote ? key(spill.myVote) : null;
  const [choice, setChoice] = useState<string | null>(mine);
  const [busy, setBusy] = useState(false);
  const send = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      const next = await api<RoomState>("PUT", `/rooms/${code}/${path}`, body);
      qc.setQueryData(["room", code], next);
    } catch {
      toast(tt("somethingWrong"), "err");
    } finally {
      setBusy(false);
    }
  };
  const vote = () => {
    if (!choice) return;
    if (choice === "skip") return send("spill-vote", { skip: true });
    const [questionId, targetId] = choice.split(":");
    return send("spill-vote", { questionId, targetId });
  };
  const count = (o: { questionId: string; playerId: string }) =>
    spill.tally.find((x) => key(x) === key(o))?.count ?? 0;
  const pick = spill.pick;
  const ROW =
    "flex min-h-14 w-full items-center gap-3 rounded-card border-[1.5px] px-4 py-3 text-left text-[15px] leading-[1.35] font-semibold";
  return (
    <section className="grid gap-3 rounded-card border border-line bg-surface p-4">
      <h2 className="m-0 font-display text-[24px] leading-none font-extrabold">
        {t("spillTitle")}
      </h2>
      <p className="m-0 text-[14px] leading-[1.45] text-text-muted">
        {spill.options.length ? t("spillBody") : t("spillNone")}
      </p>
      <div role="radiogroup" aria-label={t("spillTitle")} className="grid gap-2">
        {spill.options.map((o) => {
          const on = choice === key(o);
          return (
            <button
              key={key(o)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(key(o))}
              className={cn(
                ROW,
                on ? "border-accent bg-accent-soft" : "border-line bg-surface-raised",
              )}
            >
              <span className="min-w-0 flex-1">
                {t("spillOption", { name: name(o.playerId), text: o.text })}
              </span>
              <span className="font-mono text-[13px] font-medium text-text-muted">
                {t("spillVotes", { count: count(o) })}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={choice === "skip"}
          onClick={() => setChoice("skip")}
          className={cn(
            ROW,
            choice === "skip" ? "border-text bg-surface-raised" : "border-line bg-surface-raised",
          )}
        >
          <span className="min-w-0 flex-1">{t("spillSkip")}</span>
          <span className="font-mono text-[13px] font-medium text-text-muted">
            {t("spillSkips", { count: spill.skips })}
          </span>
        </button>
      </div>
      <Button
        block
        size="md"
        softDisabled={!choice || choice === mine}
        loading={busy}
        onClick={vote}
      >
        {t("spillVote")}
      </Button>
      <p aria-live="polite" className="m-0 text-[15px] leading-[1.45] font-semibold">
        {!pick
          ? spill.voters > 0 && (
              <span className="font-medium text-text-muted">{t("spillNoPick")}</span>
            )
          : spill.answer === "spill"
            ? pick.playerId === meId
              ? t("spillYouTelling")
              : t("spillTelling", { name: name(pick.playerId) })
            : spill.answer === "skip"
              ? pick.playerId === meId
                ? t("spillYouPassed")
                : t("spillPassed", { name: name(pick.playerId) })
              : pick.playerId === meId
                ? t("spillPickedYou", { text: pick.text })
                : t("spillPicked", { name: name(pick.playerId), text: pick.text })}
      </p>
      {pick && pick.playerId === meId && !spill.answer && (
        <div className="flex gap-2.5">
          <Button
            size="md"
            className="flex-1"
            loading={busy}
            onClick={() => send("spill-answer", { spill: true })}
          >
            {t("spillTell")}
          </Button>
          <Button
            size="md"
            variant="secondary"
            className="flex-1"
            loading={busy}
            onClick={() => send("spill-answer", { spill: false })}
          >
            {t("spillPass")}
          </Button>
        </div>
      )}
    </section>
  );
}

/** SPIL-18: "Series · Ama 2 · Esi 1" from the second round in a room; the host can reset it. */
function SeriesStrip({
  series,
  onReset,
}: {
  series: NonNullable<RoomState["series"]>;
  onReset?: () => void;
}) {
  const t = useTranslations("results");
  const standings = series.wins.map((w) => t("seriesLine", { name: w.nickname, wins: w.wins }));
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-card border border-line bg-surface px-4 py-3">
      <p
        className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] leading-[1.4]"
        aria-label={t("seriesAria", { rounds: series.rounds, standings: standings.join(", ") })}
      >
        <span className="font-semibold">{t("series")}</span>
        {series.wins.map((w) => (
          <span key={w.playerId} className="text-text-muted">
            <span aria-hidden>· </span>
            {w.nickname} <span className="font-mono text-text">{w.wins}</span>
          </span>
        ))}
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="border-0 bg-transparent p-0 text-[14px] leading-none font-semibold text-text-muted underline underline-offset-4 hover:text-text"
        >
          {t("seriesReset")}
        </button>
      )}
    </div>
  );
}

/** SPIL-23: the duo tab: one big percentage, the duo award, and each guess's error. */
function DuoPanel({
  duo,
  rows,
}: {
  duo: NonNullable<NonNullable<RoomState["results"]>["duo"]>;
  rows: NonNullable<RoomState["results"]>["rows"];
}) {
  const t = useTranslations("results");
  return (
    <div className="grid gap-5 pt-2">
      <div className="grid gap-2" aria-label={t("duoAria", { pct: duo.pct })} role="group">
        <span className="text-[15px] leading-none font-semibold text-text-muted">
          {t("duoTitle")}
        </span>
        <span className="font-mono text-[72px] leading-none font-semibold tracking-[-.04em] tabular-nums">
          {t("duoPct", { pct: duo.pct })}
        </span>
      </div>
      <div className="grid gap-1.5 border-y border-line py-4">
        <span className="font-display text-[24px] leading-none font-extrabold">
          {t(`duoAwards.${duo.award}.name`)}
        </span>
        <span className="text-[15px] leading-[1.45] text-text-muted">
          {t(`duoAwards.${duo.award}.reason`)}
        </span>
      </div>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {rows.map((r, i) => (
          <li key={r.playerId} className="flex items-center gap-2.5 text-[15px] leading-none">
            <Avatar n={r.avatar} size={28} decorative />
            {t("duoGuess", { name: r.nickname, n: duo.errors[i] ?? 0 })}
          </li>
        ))}
      </ul>
    </div>
  );
}
