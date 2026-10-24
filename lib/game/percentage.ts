import { pickAwards, type AwardResult } from "./awards";
import {
  CLOSEST_BONUS,
  computeResults,
  isScored,
  MIN_ANSWERS_FOR_STATS,
  MIN_GUESSERS_FOR_BONUS,
  mindReaderPoints,
  type ResultRow,
  type Results,
  type ResultsInput,
} from "./results";
import { toMs } from "./types";

/**
 * Room Percentage (Batch 1): everyone answers yes or no as usual, then guesses what share of
 * the room said yes to each question. Each guess earns the Mind Reader bands on how far it was
 * from the real share, plus +3 for the closest when 3 or more guessed that question. Only
 * questions that 3 or more people answered count, so a share never gives anyone's answer away.
 */
export interface PercentInput extends ResultsInput {
  /** Each player's guesses, by question id, 0 to 100. */
  percentGuesses: Readonly<Record<string, Readonly<Record<string, number | undefined>>>>;
}

export interface PercentGuess {
  playerId: string;
  value: number;
  points: number;
  closest: boolean;
}

export interface PercentQuestion {
  questionId: string;
  text: string;
  /** The room's real yes share, 0 to 100. */
  actual: number;
  answered: number;
  guesses: PercentGuess[];
}

export interface PercentResults extends Results {
  /** Scored questions in the order they were asked: one reveal slide each. */
  percentQuestions: PercentQuestion[];
}

const valid = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

export function roomPercentResults(input: PercentInput): PercentResults {
  const base = computeResults(input);
  const min = input.minAnswersForStats ?? MIN_ANSWERS_FOR_STATS;
  const scored = input.players.filter(isScored);
  const guessers = input.players.filter((p) => p.status === "active" || p.status === "sat_out");

  const percentQuestions: PercentQuestion[] = [];
  for (const q of input.questions) {
    const said = scored.map((p) => p.answers[q.id]).filter((v) => v === "yes" || v === "no");
    if (said.length < min) continue;
    const actual = Math.round((said.filter((v) => v === "yes").length / said.length) * 100);
    const on = guessers
      .map((p) => ({ playerId: p.id, value: input.percentGuesses[p.id]?.[q.id] }))
      .filter((g): g is { playerId: string; value: number } => valid(g.value))
      .map((g) => ({ ...g, value: clamp(g.value), diff: Math.abs(clamp(g.value) - actual) }));
    const best = Math.min(...on.map((g) => g.diff));
    const bonus = on.length >= MIN_GUESSERS_FOR_BONUS;
    percentQuestions.push({
      questionId: q.id,
      text: q.text,
      actual,
      answered: said.length,
      guesses: on
        .map((g) => {
          const closest = bonus && g.diff === best;
          return {
            playerId: g.playerId,
            value: g.value,
            points: mindReaderPoints(g.diff) + (closest ? CLOSEST_BONUS : 0),
            closest,
          };
        })
        .sort((a, b) => (a.playerId < b.playerId ? -1 : 1)),
    });
  }

  const total = new Map<string, number>();
  const count = new Map<string, number>();
  const exact = new Map<string, number>();
  for (const q of percentQuestions)
    for (const g of q.guesses) {
      total.set(g.playerId, (total.get(g.playerId) ?? 0) + g.points);
      count.set(g.playerId, (count.get(g.playerId) ?? 0) + 1);
      if (g.points - (g.closest ? CLOSEST_BONUS : 0) === 10)
        exact.set(g.playerId, (exact.get(g.playerId) ?? 0) + 1);
    }

  // Best reader of the room first; Spill Score breaks ties; equal points share a rank.
  const withPoints = base.rows.map((r) => ({
    ...r,
    mindReader: total.get(r.playerId) ?? 0,
    bullseyes: exact.get(r.playerId) ?? 0,
    guesses: count.get(r.playerId) ?? 0,
  }));
  const beats = (a: (typeof withPoints)[number], b: (typeof withPoints)[number]) =>
    Number(a.guesses > 0) - Number(b.guesses > 0) || a.mindReader - b.mindReader;
  const sorted = [...withPoints].sort((a, b) => beats(b, a) || b.score - a.score);
  const rows: ResultRow[] = sorted.map(({ guesses: _guesses, ...r }) => ({
    ...r,
    rank: 1 + sorted.filter((o) => beats(o, { ...r, guesses: _guesses }) > 0).length,
  }));

  // Awards about scores and reading the room; the room-guess awards do not apply here.
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const awards: AwardResult[] = pickAwards(
    rows.map((r) => ({
      playerId: r.playerId,
      nickname: r.nickname,
      score: r.score,
      avgGuessAbout: r.score,
      mindReader: r.mindReader,
      guessCount: count.get(r.playerId) ?? 0,
      joinedAt: toMs(byId.get(r.playerId)!.joinedAt),
      answersSubmittedAt: byId.get(r.playerId)!.answersSubmittedAt
        ? toMs(byId.get(r.playerId)!.answersSubmittedAt!)
        : null,
      guessesSubmittedAt: byId.get(r.playerId)!.guessesSubmittedAt
        ? toMs(byId.get(r.playerId)!.guessesSubmittedAt!)
        : null,
    })),
  )
    .filter((a) => a.award !== "dark_horse" && a.award !== "open_book")
    .map((a, i) => ({ ...a, position: i + 1 }));

  return { ...base, rows, guessPoints: [], awards, percentQuestions };
}
