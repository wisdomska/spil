import { pickAwards, type AwardId, type AwardResult } from "./awards";
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
 * Read the room modes (Batch 1). Everyone gives their own answer privately, then guesses one
 * number per question about the whole room: Room Percentage guesses the share who said yes, Hot
 * Takes guesses the average rating. Each guess earns the Mind Reader bands on how far it was from
 * the real number, plus +3 for the closest when 3 or more guessed that question. Only questions
 * that 3 or more people answered count, so the number never gives anyone's answer away.
 */
export interface PercentInput extends ResultsInput {
  /** Each player's guesses, by question id, 0 to 100. */
  percentGuesses: Readonly<Record<string, Readonly<Record<string, number | undefined>>>>;
}

/** Hot Takes: yes/no answers are not used; each player rates each statement 0 to 100. */
export interface HotTakesInput extends PercentInput {
  ratings: Readonly<Record<string, Readonly<Record<string, number | undefined>>>>;
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
  /** The room's real number, 0 to 100: the yes share, or the average rating in Hot Takes. */
  actual: number;
  answered: number;
  guesses: PercentGuess[];
}

export interface PercentResults extends Results {
  /** Scored questions in the order they were asked: one reveal slide each. */
  percentQuestions: PercentQuestion[];
}

/** Hot Takes: each player's take furthest from the room, for the results headline. */
export interface HotTake {
  questionId: string;
  text: string;
  rating: number;
  average: number;
}

export interface HotTakesResults extends PercentResults {
  hottest: Readonly<Record<string, HotTake>>;
}

const valid = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

/** Room Percentage: the real number is the share of yes among yes and no answers. */
export function roomPercentResults(input: PercentInput): PercentResults {
  const scored = input.players.filter(isScored);
  return readTheRoom(
    input,
    (q) => {
      const said = scored.map((p) => p.answers[q]).filter((v) => v === "yes" || v === "no");
      return {
        answered: said.length,
        actual: said.length ? (said.filter((v) => v === "yes").length / said.length) * 100 : 0,
      };
    },
    // The room-guess awards need a guess about a player.
    (a) => a !== "dark_horse" && a !== "open_book",
  );
}

/** Hot Takes: the real number is the room's average rating of the statement. */
export function hotTakesResults(input: HotTakesInput): HotTakesResults {
  const scored = input.players.filter(isScored);
  const ratingsOf = (q: string) =>
    scored
      .map((p) => input.ratings[p.id]?.[q])
      .filter(valid)
      .map(clamp);
  const result = readTheRoom(
    input,
    (q) => {
      const rated = ratingsOf(q);
      return {
        answered: rated.length,
        actual: rated.length ? rated.reduce((s, v) => s + v, 0) / rated.length : 0,
      };
    },
    // Spill Scores mean nothing here, so only the awards about reading the room are given.
    (a) => a === "mind_reader" || a === "clueless",
  );

  const hottest: Record<string, HotTake> = {};
  for (const p of scored) {
    let best: HotTake | null = null;
    let widest = -1;
    for (const q of result.percentQuestions) {
      const rating = input.ratings[p.id]?.[q.questionId];
      if (!valid(rating)) continue;
      const gap = Math.abs(clamp(rating) - q.actual);
      if (gap > widest) {
        widest = gap;
        best = { questionId: q.questionId, text: q.text, rating: clamp(rating), average: q.actual };
      }
    }
    if (best) hottest[p.id] = best;
  }
  return { ...result, hottest };
}

function readTheRoom(
  input: PercentInput,
  truth: (questionId: string) => { answered: number; actual: number },
  keepAward: (award: AwardId) => boolean,
): PercentResults {
  const base = computeResults(input);
  const min = input.minAnswersForStats ?? MIN_ANSWERS_FOR_STATS;
  const guessers = input.players.filter((p) => p.status === "active" || p.status === "sat_out");

  const percentQuestions: PercentQuestion[] = [];
  for (const q of input.questions) {
    const { answered, actual: raw } = truth(q.id);
    if (answered < min) continue;
    const actual = Math.round(raw);
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
      answered,
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

  // Each mode keeps only the awards that mean something in it.
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
    .filter((a) => keepAward(a.award))
    .map((a, i) => ({ ...a, position: i + 1 }));

  return { ...base, rows, guessPoints: [], awards, percentQuestions };
}
