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
 * Rank the Room (Batch 1): for each prompt everyone puts the whole room in order, themselves
 * included, in private. The room's order is each player's average position. Each ranking earns
 * up to 10 points for how close it is to the room's order (10 when it matches). A prompt needs 3
 * or more rankings to count. There is no guessing phase.
 */
export interface RankInput extends ResultsInput {
  /** Each ranker's order per question id: player ids, first is "most". */
  ranks: Readonly<Record<string, Readonly<Record<string, readonly string[] | undefined>>>>;
}

export interface RankPlace {
  playerId: string;
  /** Average position, 1 is the top. */
  average: number;
  /** 1-based; equal averages share a place. */
  place: number;
}

export interface RankQuestion {
  questionId: string;
  text: string;
  rankers: number;
  order: RankPlace[];
}

/** The highest place the room gave a player, and on which prompt. */
export interface BestPlace {
  questionId: string;
  text: string;
  place: number;
}

export interface RankResults extends Results {
  ranked: RankQuestion[];
  best: Readonly<Record<string, BestPlace>>;
}

/** Points for a ranking that matches the room's order. */
export const RANK_POINTS = 10;

/** Points for one ranking: 10 at the room's order, down to 0 at the furthest possible. */
export function rankPoints(mine: readonly string[], room: readonly RankPlace[]): number {
  const n = room.length;
  if (n < 2) return 0;
  const spot = new Map(mine.map((id, i) => [id, i + 1]));
  let distance = 0;
  for (const p of room) distance += Math.abs((spot.get(p.playerId) ?? n) - p.average);
  const furthest = Math.floor((n * n) / 2);
  return Math.max(0, Math.round(RANK_POINTS * (1 - distance / furthest)));
}

export function rankRoomResults(input: RankInput): RankResults {
  const base = computeResults(input);
  const min = input.minAnswersForStats ?? MIN_ANSWERS_FOR_STATS;
  const scored = input.players.filter(isScored);
  const known = new Set(input.players.map((p) => p.id));

  const ranked: RankQuestion[] = [];
  const points = new Map<string, number>();
  const counted = new Map<string, number>();
  for (const q of input.questions) {
    // Only players still in the game, in the order each ranker gave.
    const orders = scored
      .map((r) => ({
        ranker: r.id,
        order: (input.ranks[r.id]?.[q.id] ?? []).filter((id) => known.has(id)),
      }))
      .filter((x) => x.order.length >= 2);
    if (orders.length < min) continue;

    const sums = new Map<string, { total: number; n: number }>();
    for (const { order } of orders)
      order.forEach((id, i) => {
        const s = sums.get(id) ?? { total: 0, n: 0 };
        sums.set(id, { total: s.total + i + 1, n: s.n + 1 });
      });
    const byAverage = [...sums]
      .map(([playerId, s]) => ({ playerId, average: s.total / s.n }))
      .sort((a, b) => a.average - b.average || (a.playerId < b.playerId ? -1 : 1));
    const order = byAverage.map((p) => ({
      ...p,
      average: Math.round(p.average * 100) / 100,
      place: 1 + byAverage.filter((o) => o.average < p.average).length,
    }));
    for (const x of orders) {
      counted.set(x.ranker, (counted.get(x.ranker) ?? 0) + 1);
      points.set(x.ranker, (points.get(x.ranker) ?? 0) + rankPoints(x.order, order));
    }
    ranked.push({ questionId: q.id, text: q.text, rankers: orders.length, order });
  }

  // Each player's highest place; the lower average breaks a tie between prompts.
  const best: Record<string, BestPlace> = {};
  const bestAverage = new Map<string, number>();
  for (const q of ranked)
    for (const p of q.order) {
      const was = best[p.playerId];
      if (
        !was ||
        p.place < was.place ||
        (p.place === was.place && p.average < bestAverage.get(p.playerId)!)
      ) {
        best[p.playerId] = { questionId: q.questionId, text: q.text, place: p.place };
        bestAverage.set(p.playerId, p.average);
      }
    }

  // Closest to the room first; Spill Score is not used. Equal points share a rank.
  const withPoints = base.rows.map((r) => ({
    ...r,
    mindReader: points.get(r.playerId) ?? 0,
    bullseyes: 0,
    counted: counted.get(r.playerId) ?? 0,
  }));
  const beats = (a: (typeof withPoints)[number], b: (typeof withPoints)[number]) =>
    Number(a.counted > 0) - Number(b.counted > 0) || a.mindReader - b.mindReader;
  const sorted = [...withPoints].sort((a, b) => beats(b, a) || (a.nickname < b.nickname ? -1 : 1));
  const rows: ResultRow[] = sorted.map(({ counted: c, ...r }) => ({
    ...r,
    rank: 1 + sorted.filter((o) => beats(o, { ...r, counted: c }) > 0).length,
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
      guessCount: counted.get(r.playerId) ?? 0,
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

  return { ...base, rows, guessPoints: [], awards, ranked, best };
}

/**
 * A fair starting order for a ranking: the players shuffled by the prompt id, so nobody anchors
 * on the roster order and every phone starts from the same shuffle for the same prompt.
 */
export function startingOrder<T extends { id: string }>(players: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...players];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
