/** Admin Users helpers (owner request 2026-11-12). Pure, shared by the API and the console. */
import { toCsv } from "./csv";
import type { AdminUser } from "./types";
import { USER_SORTS, type UserSort } from "./schemas";

/** When a ban of `days` days ends, or null for a ban that lasts until an admin lifts it. */
export function banEnds(days: 1 | 7 | 30 | null, now: Date): string | null {
  if (days === null) return null;
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

export function parseUserSort(raw: string | null | undefined): UserSort {
  return (USER_SORTS as readonly string[]).includes(raw ?? "") ? (raw as UserSort) : "joined_desc";
}

/** The sort a column header sets when clicked: its own key, flipped if it is already on. */
export function nextSort(
  current: UserSort,
  column: "joined" | "seen" | "games" | "points" | "name",
) {
  const desc = `${column}_desc` as UserSort;
  const asc = `${column}_asc` as UserSort;
  // Names read A to Z first; numbers and dates show the biggest or newest first.
  const first = column === "name" ? asc : desc;
  const second = column === "name" ? desc : asc;
  return current === first ? second : first;
}

export function sortDirection(
  current: UserSort,
  column: "joined" | "seen" | "games" | "points" | "name",
): "ascending" | "descending" | undefined {
  if (current === `${column}_asc`) return "ascending";
  if (current === `${column}_desc`) return "descending";
  return undefined;
}

export function usersToCsv(rows: readonly AdminUser[]) {
  return toCsv(
    [
      "name",
      "kind",
      "games",
      "wins",
      "points",
      "crews",
      "joined",
      "last_seen",
      "banned",
      "banned_until",
    ],
    rows.map((u) => [
      u.username ?? "",
      u.kind,
      u.games,
      u.wins,
      u.points,
      u.crews,
      u.createdAt,
      u.lastSeen ?? "",
      u.banned ? "yes" : "no",
      u.bannedUntil ?? "",
    ]),
  );
}
