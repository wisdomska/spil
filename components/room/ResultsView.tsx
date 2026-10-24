"use client";

import { HourglassMediumIcon, TrophyIcon } from "@phosphor-icons/react";
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
import { Sheet } from "@/components/ui/Sheet";
import { SwitchRow } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import type { RoomState } from "@/lib/api/types";
import { isTiedRank, labelById, rankByGuessing, verdictBand } from "@/lib/game";
import { saveLastGame } from "@/lib/share/capture";

/** Wall-clock time for the saved card (called from an effect, never during render). */
const timestamp = () => Date.now();

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
  const [explain, setExplain] = useState(false);
  const results = state.results;
  const host = state.players.find((p) => p.isHost);
  const hot = state.room.mode === "hot_takes";
  const likely = state.room.mode === "most_likely";
  const flags = state.room.mode === "red_green";
  // Modes without a Spill Score: no labels, Spill Mode or share card.
  const noSpill = hot || likely || flags;

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
  const pct = state.room.mode !== "classic";
  const solo = (meRow?.guessedBy ?? 0) === 0;
  // Room Percentage: nobody guesses about players; the points are for reading the room.
  const anyGuesses =
    state.room.mode === "red_green"
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
      {flags ? (
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
              {t("headline")}{" "}
              <span className="text-accent-ink" style={{ fontStretch: "75%" }}>
                {myLabel}.
              </span>
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
                <span className="min-w-[18px] font-mono text-[14px] leading-none font-medium whitespace-nowrap text-text-muted">
                  {rankText(r.rank)}
                </span>
                <span className="relative shrink-0">
                  <Avatar n={r.avatar} size={40} label={r.nickname} />
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
          {anyGuesses && !likely && !flags && (
            <button
              type="button"
              onClick={() => setExplain(true)}
              className="mt-3 -ml-2.5 flex h-11 items-center gap-1.5 rounded-pill border-0 bg-transparent pr-3.5 pl-2.5 text-[14px] leading-none font-semibold text-accent-ink hover:bg-surface-raised"
            >
              {t("howPoints")}
            </button>
          )}
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
          {flags ? (
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

      {!noSpill && (
        <SwitchRow
          checked={state.me.spillMode}
          onCheckedChange={(on) => {
            onSpill(on);
            toast(on ? tt("spillOn") : tt("spillOff"));
          }}
          title={t("spillMode")}
          description={state.me.spillMode ? t("spillOnCopy") : t("spillOffCopy")}
        />
      )}

      <div className="flex gap-2.5 pb-2">
        {!noSpill && (
          <button
            type="button"
            onClick={() => setShare(true)}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-pill border-[1.5px] border-text bg-transparent text-[17px] leading-none font-semibold text-text hover:bg-surface-raised"
          >
            {t("share")}
          </button>
        )}
        {state.me.isHost ? (
          <Link
            href={`/create?room=${state.room.code}&mode=rematch&pack=${state.room.pack.id}`}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-pill bg-accent text-[17px] leading-none font-semibold text-on-accent no-underline hover:text-on-accent hover:shadow-[inset_0_0_0_99px_var(--press-glow)] active:scale-[.97]"
          >
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
