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
 * Most Likely To (Batch 1): everyone votes, in private, for the player most likely to do each
 * prompt. Votes are anonymous: the reveal shows counts, never who voted for whom, and a prompt
 * needs 3 or more votes to count. There is no guessing phase; voting with the room is the game:
 * each vote for the room's pick (any of them, when tied) earns points.
 */
export interface MostLikelyInput extends ResultsInput {
  /** Each voter's pick, by question id: the player id they voted for. */
  votes: Readonly<Record<string, Readonly<Record<string, string | undefined>>>>;
}

export interface LikelyTally {
  playerId: string;
  count: number;
}

export interface LikelyQuestion {
  questionId: string;
  text: string;
  /** How many voted on this prompt. */
  voters: number;
  /** Players with at least one vote, most votes first. */
  tally: LikelyTally[];
  /** The room's pick: every player with the most votes. */
  top: string[];
}

/** The prompt the room picked a player for, with the most votes behind it. */
export interface Crowned {
  questionId: string;
  text: string;
  count: number;
  voters: number;
}

export interface MostLikelyResults extends Results {
  likely: LikelyQuestion[];
  crowned: Readonly<Record<string, Crowned>>;
}

/** Points for each vote that matched the room's pick. */
export const WITH_THE_ROOM = 10;

export function mostLikelyResults(input: MostLikelyInput): MostLikelyResults {
  const base = computeResults(input);
  const min = input.minAnswersForStats ?? MIN_ANSWERS_FOR_STATS;
  const voters = input.players.filter(isScored);
  const known = new Set(input.players.map((p) => p.id));

  const likely: LikelyQuestion[] = [];
  const points = new Map<string, number>();
  const voted = new Map<string, number>();
  for (const q of input.questions) {
    const picks = voters
      .map((v) => ({ voter: v.id, pick: input.votes[v.id]?.[q.id] }))
      .filter((x): x is { voter: string; pick: string } =>
        Boolean(x.pick && x.pick !== x.voter && known.has(x.pick)),
      );
    if (picks.length < min) continue;
    const counts = new Map<string, number>();
    for (const x of picks) counts.set(x.pick, (counts.get(x.pick) ?? 0) + 1);
    const tally = [...counts]
      .map(([playerId, count]) => ({ playerId, count }))
      .sort((a, b) => b.count - a.count || (a.playerId < b.playerId ? -1 : 1));
    const most = tally[0]!.count;
    const top = tally.filter((t) => t.count === most).map((t) => t.playerId);
    for (const x of picks) {
      voted.set(x.voter, (voted.get(x.voter) ?? 0) + 1);
      if (top.includes(x.pick)) points.set(x.voter, (points.get(x.voter) ?? 0) + WITH_THE_ROOM);
    }
    likely.push({ questionId: q.id, text: q.text, voters: picks.length, tally, top });
  }

  // Each player's strongest pick: the prompt they topped with the largest share of the votes.
  const crowned: Record<string, Crowned> = {};
  for (const q of likely)
    for (const id of q.top) {
      const count = q.tally.find((t) => t.playerId === id)!.count;
      const was = crowned[id];
      if (!was || count / q.voters > was.count / was.voters)
        crowned[id] = { questionId: q.questionId, text: q.text, count, voters: q.voters };
    }

  // Most votes with the room first; Spill Score is not used. Equal points share a rank.
  const withPoints = base.rows.map((r) => ({
    ...r,
    mindReader: points.get(r.playerId) ?? 0,
    bullseyes: 0,
    votes: voted.get(r.playerId) ?? 0,
  }));
  const beats = (a: (typeof withPoints)[number], b: (typeof withPoints)[number]) =>
    Number(a.votes > 0) - Number(b.votes > 0) || a.mindReader - b.mindReader;
  const sorted = [...withPoints].sort((a, b) => beats(b, a) || (a.nickname < b.nickname ? -1 : 1));
  const rows: ResultRow[] = sorted.map(({ votes, ...r }) => ({
    ...r,
    rank: 1 + sorted.filter((o) => beats(o, { ...r, votes }) > 0).length,
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
      guessCount: voted.get(r.playerId) ?? 0,
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

  return { ...base, rows, guessPoints: [], awards, likely, crowned };
}
