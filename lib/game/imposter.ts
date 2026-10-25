import { pickAwards, type AwardResult } from "./awards";
import {
  computeResults,
  isScored,
  type ResultRow,
  type Results,
  type ResultsInput,
} from "./results";
import { toMs } from "./types";

/**
 * Imposter (Batch 1): everyone answers the same questions from 0 to 100, except one secret
 * player, who gets a different question each time and is not told. In this mode answers are
 * shown to the room (harmless pairs packs, said up front), then everyone votes for who they think
 * had different questions. Each right vote earns points; the imposter earns more by escaping. A
 * tie at the top means the room could not agree, so the imposter escapes.
 */
export interface ImposterInput extends ResultsInput {
  /** Each player's answers, by question id, 0 to 100. */
  ratings: Readonly<Record<string, Readonly<Record<string, number | undefined>>>>;
  /** Each voter's suspect. */
  suspects: Readonly<Record<string, string | undefined>>;
  imposterId: string | null;
  /** The imposter's question for each question id. */
  altText: Readonly<Record<string, string>>;
}

export interface ImposterBoardRow {
  questionId: string;
  text: string;
  /** What the imposter was asked instead. */
  altText: string;
  answers: Array<{ playerId: string; value: number }>;
}

export interface ImposterOutcome {
  imposterId: string | null;
  /** Votes per suspect, most first. */
  tally: Array<{ playerId: string; count: number }>;
  /** Everyone with the most votes. */
  top: string[];
  caught: boolean;
  voters: number;
  board: ImposterBoardRow[];
}

export interface ImposterResults extends Results {
  imposter: ImposterOutcome;
}

/** Points for a vote for the imposter, and for an imposter who escapes. */
export const RIGHT_VOTE = 10;
export const ESCAPED = 20;

const valid = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** The answers everyone sees while voting: each question with every player's number. */
export function imposterBoard(
  input: Pick<ImposterInput, "questions" | "players" | "ratings" | "altText">,
): ImposterBoardRow[] {
  const scored = input.players.filter(isScored);
  return input.questions.map((q) => ({
    questionId: q.id,
    text: q.text,
    altText: input.altText[q.id] ?? q.text,
    answers: scored
      .map((p) => ({ playerId: p.id, value: input.ratings[p.id]?.[q.id] }))
      .filter((a): a is { playerId: string; value: number } => valid(a.value)),
  }));
}

export function imposterResults(input: ImposterInput): ImposterResults {
  const base = computeResults(input);
  const inGame = input.players.filter((p) => p.status === "active" || p.status === "sat_out");
  const ids = new Set(inGame.map((p) => p.id));

  const counts = new Map<string, number>();
  let voters = 0;
  for (const p of inGame) {
    const s = input.suspects[p.id];
    if (!s || s === p.id || !ids.has(s)) continue;
    voters += 1;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const tally = [...counts]
    .map(([playerId, count]) => ({ playerId, count }))
    .sort((a, b) => b.count - a.count || (a.playerId < b.playerId ? -1 : 1));
  const most = tally[0]?.count ?? 0;
  const top = tally.filter((t) => t.count === most && most > 0).map((t) => t.playerId);
  const caught = input.imposterId !== null && top.length === 1 && top[0] === input.imposterId;

  const points = new Map<string, number>();
  for (const p of inGame) {
    if (p.id === input.imposterId) {
      if (!caught) points.set(p.id, ESCAPED);
    } else if (input.imposterId && input.suspects[p.id] === input.imposterId) {
      points.set(p.id, RIGHT_VOTE);
    }
  }
  const votedFor = new Map(inGame.map((p) => [p.id, input.suspects[p.id] ? 1 : 0]));

  // Most points first; Spill Score is not used. Equal points share a rank.
  const withPoints = base.rows.map((r) => ({
    ...r,
    mindReader: points.get(r.playerId) ?? 0,
    bullseyes: 0,
  }));
  const sorted = [...withPoints].sort(
    (a, b) => b.mindReader - a.mindReader || (a.nickname < b.nickname ? -1 : 1),
  );
  const rows: ResultRow[] = sorted.map((r) => ({
    ...r,
    rank: 1 + sorted.filter((o) => o.mindReader > r.mindReader).length,
  }));

  const byId = new Map(input.players.map((p) => [p.id, p]));
  const awards: AwardResult[] = pickAwards(
    rows.map((r) => ({
      playerId: r.playerId,
      nickname: r.nickname,
      score: r.score,
      avgGuessAbout: r.score,
      mindReader: r.mindReader,
      guessCount: votedFor.get(r.playerId) ?? 0,
      joinedAt: toMs(byId.get(r.playerId)!.joinedAt),
      answersSubmittedAt: byId.get(r.playerId)!.answersSubmittedAt
        ? toMs(byId.get(r.playerId)!.answersSubmittedAt!)
        : null,
      guessesSubmittedAt: byId.get(r.playerId)!.guessesSubmittedAt
        ? toMs(byId.get(r.playerId)!.guessesSubmittedAt!)
        : null,
    })),
  )
    .filter((a) => a.award === "mind_reader")
    .map((a, i) => ({ ...a, position: i + 1 }));

  return {
    ...base,
    rows,
    guessPoints: [],
    awards,
    imposter: {
      imposterId: input.imposterId,
      tally,
      top,
      caught,
      voters,
      board: imposterBoard(input),
    },
  };
}
