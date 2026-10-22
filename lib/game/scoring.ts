import type { AnswerValue, Check } from "./types";

/** Share of a round's questions a player may skip. */
export const SKIP_LIMIT_RATIO = 0.1;

export interface AnswerTally {
  yes: number;
  no: number;
  skip: number;
}

export function tallyAnswers(values: Iterable<AnswerValue | null | undefined>): AnswerTally {
  const t: AnswerTally = { yes: 0, no: 0, skip: 0 };
  for (const v of values) if (v === "yes" || v === "no" || v === "skip") t[v]++;
  return t;
}

/** Spill Score: round(100 * yes / (yes + no)). Skips are excluded; 0 when nothing was answered. */
export function spillScore(values: Iterable<AnswerValue | null | undefined>): number {
  const { yes, no } = tallyAnswers(values);
  return yes + no === 0 ? 0 : Math.round((100 * yes) / (yes + no));
}

/** Score using only this round's questions, ignoring answers to anything else. */
export function scoreForRound(
  answers: Readonly<Record<string, AnswerValue | undefined>>,
  questionIds: readonly string[],
): number {
  return spillScore(questionIds.map((id) => answers[id]));
}

/**
 * Most skips allowed for a round: 10% of its questions, rounded down, but never below 1 so the
 * Skip button stays usable in short rounds (5 to 9 questions).
 */
export function skipLimit(questionCount: number): number {
  if (questionCount <= 0) return 0;
  return Math.max(1, Math.floor(questionCount * SKIP_LIMIT_RATIO));
}

export type SubmitAnswersError = "INCOMPLETE" | "SKIP_LIMIT" | "UNKNOWN_QUESTION";

/** Rules for locking answers: every round question answered, nothing foreign, skips within the limit. */
export function checkAnswerSubmission(
  answers: Readonly<Record<string, AnswerValue | undefined>>,
  questionIds: readonly string[],
): Check<SubmitAnswersError> {
  const round = new Set(questionIds);
  if (Object.keys(answers).some((id) => !round.has(id)))
    return { ok: false, code: "UNKNOWN_QUESTION" };
  const values = questionIds.map((id) => answers[id]);
  if (values.some((v) => v === undefined)) return { ok: false, code: "INCOMPLETE" };
  if (tallyAnswers(values).skip > skipLimit(questionIds.length))
    return { ok: false, code: "SKIP_LIMIT" };
  return { ok: true };
}
