import { MODE_RULES, type Mode } from "@/lib/game";

/** One public page per game (/games/<slug>). Slugs are URLs, so never rename one. */
export const GAME_PAGES: Array<{ mode: Mode; slug: string }> = [
  { mode: "classic", slug: "spill-score" },
  { mode: "most_likely", slug: "most-likely-to" },
  { mode: "hot_takes", slug: "hot-takes" },
  { mode: "two_truths", slug: "two-truths-and-a-spill" },
  { mode: "imposter", slug: "imposter" },
  { mode: "who_said", slug: "who-said-that" },
  { mode: "rank_room", slug: "rank-the-room" },
  { mode: "red_green", slug: "red-flag-green-flag" },
  { mode: "room_percentage", slug: "room-percentage" },
  { mode: "spill_or_skip", slug: "spill-or-skip" },
];

export const gamePage = (slug: string) => GAME_PAGES.find((g) => g.slug === slug);

/** Players and age floor for a game, from the game rules. */
export function gameFacts(mode: Mode) {
  const rule = MODE_RULES[mode];
  return { minPlayers: rule.minPlayers, adultOnly: rule.adultOnly };
}

/** "Start a game of X" opens setup on that game (a game the player is too young for falls back to the list). */
export const startHref = (mode: Mode) => `/create?game=${mode}`;
