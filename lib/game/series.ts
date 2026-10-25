/**
 * Series score (SPIL-18): rounds played in one room since the host last reset it. A round is won
 * by the most Mind Reader points; tied players each get the win; a round nobody scored in has no
 * winner. Pure, so the rule is tested here.
 */
export interface SeriesRound {
  round: number;
  playerId: string;
  mindReader: number;
}

export interface SeriesScore {
  rounds: number;
  /** Wins by player id. Players with no win are absent. */
  wins: Map<string, number>;
}

export function seriesScore(rows: readonly SeriesRound[]): SeriesScore {
  const byRound = new Map<number, SeriesRound[]>();
  for (const r of rows) byRound.set(r.round, [...(byRound.get(r.round) ?? []), r]);
  const wins = new Map<string, number>();
  for (const round of byRound.values()) {
    const top = Math.max(...round.map((r) => r.mindReader));
    if (top <= 0) continue;
    for (const r of round)
      if (r.mindReader === top) wins.set(r.playerId, (wins.get(r.playerId) ?? 0) + 1);
  }
  return { rounds: byRound.size, wins };
}

/** The strip shows from the second round of a series. */
export const SERIES_MIN_ROUNDS = 2;
