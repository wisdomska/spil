import { cryptoRng, randomIndex, type ContentStatus, type Rng } from "./types";

export interface DrawableQuestion {
  id: string;
  packId: string;
  status: ContentStatus;
}

export interface PickablePack {
  id: string;
  status: ContentStatus;
}

export function isLiveQuestion(question: DrawableQuestion, packId: string): boolean {
  return question.packId === packId && question.status === "live";
}

export function liveQuestionCount(questions: readonly DrawableQuestion[], packId: string): number {
  return questions.filter((q) => isLiveQuestion(q, packId)).length;
}

/** Packs that appear in the picker: status live and at least one live question. */
export function pickablePacks<P extends PickablePack>(
  packs: readonly P[],
  questions: readonly DrawableQuestion[],
): P[] {
  return packs.filter((p) => p.status === "live" && questions.some((q) => isLiveQuestion(q, p.id)));
}

/**
 * Draws `count` unique random live questions from a pack (or all of them if the pack has fewer).
 * Hidden and draft questions are never drawn. Duplicate ids in the input are drawn at most once.
 */
export function drawQuestions<Q extends DrawableQuestion>(
  questions: readonly Q[],
  packId: string,
  count: number,
  rng: Rng = cryptoRng,
): Q[] {
  const seen = new Set<string>();
  const pool: Q[] = [];
  for (const q of questions) {
    if (!isLiveQuestion(q, packId) || seen.has(q.id)) continue;
    seen.add(q.id);
    pool.push(q);
  }
  const n = Math.min(pool.length, Math.max(0, Math.floor(count)));
  // Partial Fisher-Yates: the first n slots end up a uniform random sample.
  for (let i = 0; i < n; i++) {
    const j = i + randomIndex(rng, pool.length - i);
    const a = pool[i] as Q;
    pool[i] = pool[j] as Q;
    pool[j] = a;
  }
  return pool.slice(0, n);
}
