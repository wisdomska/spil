/** Overview numbers and the stats CSV export. Pure. */
import { toCsv } from "./csv";

export type DayStats = { day: string; gamesStarted: number; gamesFinished: number; joins: number };

/** Whole percentage of started games that reached the reveal, or null with nothing started. */
export function completionRate(started: number, finished: number): number | null {
  if (started <= 0) return null;
  return Math.min(100, Math.round((finished / started) * 100));
}

/** ISO date (YYYY-MM-DD, UTC) `offset` days before `now`. */
export function isoDay(now: Date, offset = 0): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Totals over days on or after `since` (inclusive). */
export function totalsSince(days: ReadonlyArray<DayStats>, since: string) {
  return days
    .filter((d) => d.day >= since)
    .reduce(
      (acc, d) => ({
        gamesStarted: acc.gamesStarted + d.gamesStarted,
        gamesFinished: acc.gamesFinished + d.gamesFinished,
        joins: acc.joins + d.joins,
      }),
      { gamesStarted: 0, gamesFinished: 0, joins: 0 },
    );
}

/** One row per day for the last `count` days, newest first, zero filled. */
export function fillDays(days: ReadonlyArray<DayStats>, now: Date, count: number): DayStats[] {
  const map = new Map(days.map((d) => [d.day, d]));
  return Array.from({ length: count }, (_, i) => {
    const day = isoDay(now, i);
    return map.get(day) ?? { day, gamesStarted: 0, gamesFinished: 0, joins: 0 };
  });
}

export function statsToCsv(days: ReadonlyArray<DayStats>) {
  return toCsv(
    ["day", "games_started", "games_finished", "joins", "completion_rate"],
    days.map((d) => {
      const rate = completionRate(d.gamesStarted, d.gamesFinished);
      return [d.day, d.gamesStarted, d.gamesFinished, d.joins, rate === null ? "" : `${rate}%`];
    }),
  );
}
