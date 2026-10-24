import { pickAwards, type AwardResult } from "./awards";
import {
  computeResults,
  isScored,
  MIN_ANSWERS_FOR_STATS,
  type ResultRow,
  type Results,
  type ResultsInput,
} from "./results";
import { toMs } from "./types";

/**
 * Red Flag, Green Flag (Batch 1): everyone swipes each scenario green or red, in private, using
 * the yes or no answers (yes is green, no is red). There is no guessing phase. The reveal shows
 * each scenario's split once 3 or more people answered it, and every answer on the room's side
 * (a strict majority) earns points. An even split has no side and earns nothing.
 */
export type FlagVerdict = "green" | "red" | "split";

export interface FlagQuestion {
  questionId: string;
  text: string;
  green: number;
  red: number;
  /** Share of green among green and red, 0 to 100. */
  greenShare: number;
  verdict: FlagVerdict;
}

/** The scenario a player was most outnumbered on, shown only to them. */
export interface LoneFlag {
  questionId: string;
  text: string;
  /** What the player swiped. */
  side: "green" | "red";
  /** Share of the room on the other side, 0 to 100. */
  against: number;
}

export interface FlagResults extends Results {
  flags: FlagQuestion[];
  lone: Readonly<Record<string, LoneFlag>>;
}

/** Points for each answer on the room's side. */
export const IN_STEP = 10;

export function flagResults(input: ResultsInput): FlagResults {
  const base = computeResults(input);
  const min = input.minAnswersForStats ?? MIN_ANSWERS_FOR_STATS;
  const scored = input.players.filter(isScored);

  const flags: FlagQuestion[] = [];
  const points = new Map<string, number>();
  const answered = new Map<string, number>();
  const lone: Record<string, LoneFlag> = {};
  const loneShare = new Map<string, number>();
  for (const q of input.questions) {
    const said = scored
      .map((p) => ({ id: p.id, v: p.answers[q.id] }))
      .filter((x): x is { id: string; v: "yes" | "no" } => x.v === "yes" || x.v === "no");
    if (said.length < min) continue;
    const green = said.filter((x) => x.v === "yes").length;
    const red = said.length - green;
    const verdict: FlagVerdict = green > red ? "green" : red > green ? "red" : "split";
    flags.push({
      questionId: q.id,
      text: q.text,
      green,
      red,
      greenShare: Math.round((green / said.length) * 100),
      verdict,
    });
    for (const x of said) {
      const side = x.v === "yes" ? "green" : "red";
      answered.set(x.id, (answered.get(x.id) ?? 0) + 1);
      if (side === verdict) points.set(x.id, (points.get(x.id) ?? 0) + IN_STEP);
      // Outnumbered: on the smaller side. Keep the scenario with the smallest share.
      const mine = side === "green" ? green : red;
      const share = mine / said.length;
      if (verdict !== "split" && side !== verdict && share < (loneShare.get(x.id) ?? Infinity)) {
        loneShare.set(x.id, share);
        lone[x.id] = {
          questionId: q.id,
          text: q.text,
          side,
          against: Math.round(((said.length - mine) / said.length) * 100),
        };
      }
    }
  }

  // Most answers in step first; Spill Score is not used. Equal points share a rank.
  const withPoints = base.rows.map((r) => ({
    ...r,
    mindReader: points.get(r.playerId) ?? 0,
    bullseyes: 0,
    counted: answered.get(r.playerId) ?? 0,
  }));
  const beats = (a: (typeof withPoints)[number], b: (typeof withPoints)[number]) =>
    Number(a.counted > 0) - Number(b.counted > 0) || a.mindReader - b.mindReader;
  const sorted = [...withPoints].sort((a, b) => beats(b, a) || (a.nickname < b.nickname ? -1 : 1));
  const rows: ResultRow[] = sorted.map(({ counted, ...r }) => ({
    ...r,
    rank: 1 + sorted.filter((o) => beats(o, { ...r, counted }) > 0).length,
  }));

  // Only the awards about reading the room mean something here.
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const awards: AwardResult[] = pickAwards(
    rows.map((r) => ({
      playerId: r.playerId,
      nickname: r.nickname,
      score: r.score,
      avgGuessAbout: r.score,
      mindReader: r.mindReader,
      guessCount: answered.get(r.playerId) ?? 0,
      joinedAt: toMs(byId.get(r.playerId)!.joinedAt),
      answersSubmittedAt: byId.get(r.playerId)!.answersSubmittedAt
        ? toMs(byId.get(r.playerId)!.answersSubmittedAt!)
        : null,
      guessesSubmittedAt: byId.get(r.playerId)!.guessesSubmittedAt
        ? toMs(byId.get(r.playerId)!.guessesSubmittedAt!)
        : null,
    })),
  )
    .filter((a) => a.award === "mind_reader" || a.award === "clueless")
    .map((a, i) => ({ ...a, position: i + 1 }));

  return { ...base, rows, guessPoints: [], awards, flags, lone };
}
