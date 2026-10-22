import type { AnswerValue, ResultsPlayer, ResultsQuestion, Rng } from "@/lib/game";

/** Deterministic RNG (mulberry32) so draws and codes are reproducible. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG that replays a fixed list of values, cycling. */
export function sequenceRng(values: readonly number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

export function questions(n: number, prefix = "q"): ResultsQuestion[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, text: `question ${i}?` }));
}

/** Builds answers for a list of questions from a predicate on the index. */
export function answers(
  qs: readonly ResultsQuestion[],
  pick: (i: number) => AnswerValue | undefined,
): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  qs.forEach((q, i) => {
    const v = pick(i);
    if (v) out[q.id] = v;
  });
  return out;
}

let clock = 1_700_000_000_000;

export function player(
  id: string,
  nickname: string,
  extra: Partial<ResultsPlayer> = {},
): ResultsPlayer {
  clock += 1000;
  return {
    id,
    nickname,
    status: "active",
    joinedAt: clock,
    answersSubmittedAt: clock + 100_000,
    guessesSubmittedAt: clock + 200_000,
    spillMode: false,
    answers: {},
    guesses: {},
    ...extra,
  };
}

/** Every player guesses `value` about every other player. */
export function guessAll(players: ResultsPlayer[], value: number): ResultsPlayer[] {
  return players.map((p) => ({
    ...p,
    guesses: Object.fromEntries(players.filter((o) => o.id !== p.id).map((o) => [o.id, value])),
  }));
}
