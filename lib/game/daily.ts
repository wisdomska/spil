/**
 * Daily Spill (Batch 2): one question a day for everyone, from a 13+ pack. The day runs on UTC,
 * which is also Ghana's time. The share of yes only shows once enough people answered, so a
 * small count never gives anyone away. The streak is counted from the player's own answers, so it
 * follows an account to a new phone.
 */
export const MIN_DAILY_ANSWERS = 10;

/** The day an instant falls on, as YYYY-MM-DD in UTC. */
export function dayKey(at: Date | number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD key. */
export function dayNumber(key: string): number {
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

/**
 * The question for a day: the ids in a fixed order, walked one a day, so no question repeats
 * until every one has had its day.
 */
export function pickDaily(ids: readonly string[], key: string): string | null {
  if (!ids.length) return null;
  const sorted = [...ids].sort();
  return sorted[((dayNumber(key) % sorted.length) + sorted.length) % sorted.length]!;
}

/** The share of yes, or null while fewer than the minimum answered. */
export function dailyShare(yes: number, total: number): number | null {
  return total >= MIN_DAILY_ANSWERS ? Math.round((yes / total) * 100) : null;
}

/** Days in a row answered, ending today; 0 when today is not answered yet. */
export function streakFromDays(days: readonly string[], today: string): number {
  const answered = new Set(days.map(dayNumber));
  let n = 0;
  for (let d = dayNumber(today); answered.has(d); d--) n++;
  return n;
}

export interface Streak {
  last: string;
  days: number;
}

/** The streak after answering on `today`: one more if yesterday was answered, else a fresh 1. */
export function nextStreak(prev: Streak | null, today: string): Streak {
  if (!prev) return { last: today, days: 1 };
  if (prev.last === today) return prev;
  return { last: today, days: dayNumber(today) - dayNumber(prev.last) === 1 ? prev.days + 1 : 1 };
}
