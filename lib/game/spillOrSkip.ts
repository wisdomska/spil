import { isScored, type ResultsQuestion, type ResultsPlayer } from "./results";

/**
 * Spill or Skip (Batch 1): a classic round, then on the results the room votes for one yes it
 * wants the story behind. Only players who switched on Spill Mode can be picked (they chose to
 * show their yeses), anyone can vote Skip, and the picked player can still pass.
 */
export interface SpillOption {
  questionId: string;
  text: string;
  playerId: string;
}

export type SpillVote = { questionId: string; playerId: string } | "skip";

export interface SpillTally {
  options: SpillOption[];
  /** Votes per option, most first; only options with votes. */
  tally: Array<SpillOption & { count: number }>;
  skips: number;
  voters: number;
  /** The room's pick: one option with the most votes and more votes than Skip. */
  pick: SpillOption | null;
}

/** Every yes from a player in Spill Mode: what the room may ask about. */
export function spillOptions(
  questions: readonly ResultsQuestion[],
  players: readonly ResultsPlayer[],
): SpillOption[] {
  return players
    .filter((p) => isScored(p) && p.spillMode)
    .flatMap((p) =>
      questions
        .filter((q) => p.answers[q.id] === "yes")
        .map((q) => ({ questionId: q.id, text: q.text, playerId: p.id })),
    );
}

export function isSpillOption(options: readonly SpillOption[], vote: SpillVote): boolean {
  return (
    vote === "skip" ||
    options.some((o) => o.questionId === vote.questionId && o.playerId === vote.playerId)
  );
}

export function tallySpill(
  options: readonly SpillOption[],
  votes: Readonly<Record<string, SpillVote | undefined>>,
): SpillTally {
  const counts = new Map<string, number>();
  let skips = 0;
  let voters = 0;
  for (const v of Object.values(votes)) {
    if (!v || !isSpillOption(options, v)) continue;
    voters += 1;
    if (v === "skip") skips += 1;
    else {
      const key = `${v.questionId}:${v.playerId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const tally = options
    .map((o) => ({ ...o, count: counts.get(`${o.questionId}:${o.playerId}`) ?? 0 }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);
  const most = tally[0]?.count ?? 0;
  const top = tally.filter((t) => t.count === most);
  const pick =
    top.length === 1 && most > skips
      ? { questionId: top[0]!.questionId, text: top[0]!.text, playerId: top[0]!.playerId }
      : null;
  return { options: [...options], tally, skips, voters, pick };
}
