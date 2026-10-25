/**
 * Crews and seasons (Batch 3): a saved group of friends with no signup (device session plus an
 * invite link). Each round played as the crew keeps only nicknames, Mind Reader points and ranks,
 * never answers or Spill Scores. A season is a calendar month (UTC); the season table adds up each
 * member's points.
 */
export interface CrewRoundScore {
  userId: string;
  nickname: string;
  points: number;
  rank: number;
}

export interface CrewRound {
  playedAt: string;
  scores: readonly CrewRoundScore[];
}

export interface SeasonRow {
  userId: string;
  nickname: string;
  points: number;
  rounds: number;
  wins: number;
  /** 1-based; equal points share a place. */
  place: number;
}

export const MAX_CREW_NAME = 40;
export const MAX_CREW_MEMBERS = 20;

/** The season an instant falls in: YYYY-MM (UTC). */
export function seasonKey(at: Date | number | string): string {
  return new Date(at).toISOString().slice(0, 7);
}

/** The season table for one month: members only, most points first, ties share a place. */
export function seasonTable(
  rounds: readonly CrewRound[],
  members: ReadonlySet<string>,
  season: string,
): SeasonRow[] {
  const rows = new Map<string, Omit<SeasonRow, "place">>();
  for (const round of rounds) {
    if (seasonKey(round.playedAt) !== season) continue;
    for (const s of round.scores) {
      if (!members.has(s.userId)) continue;
      const row = rows.get(s.userId) ?? {
        userId: s.userId,
        nickname: s.nickname,
        points: 0,
        rounds: 0,
        wins: 0,
      };
      row.points += s.points;
      row.rounds += 1;
      if (s.rank === 1) row.wins += 1;
      // The latest round's nickname wins, so renames show.
      row.nickname = s.nickname;
      rows.set(s.userId, row);
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.nickname < b.nickname ? -1 : 1),
  );
  return sorted.map((r) => ({ ...r, place: 1 + sorted.filter((o) => o.points > r.points).length }));
}
