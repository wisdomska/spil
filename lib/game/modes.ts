/**
 * Game modes (owner features, Batch 1). A room plays one mode for a round. Classic is SPIL as it
 * was; the others reuse rooms, the lobby, phone input, the vessel and the host-paced reveal.
 */
export const MODES = [
  "classic",
  "room_percentage",
  "hot_takes",
  "most_likely",
  "red_green",
  "rank_room",
  "imposter",
  "two_truths",
  "who_said",
  "spill_or_skip",
] as const;
export type Mode = (typeof MODES)[number];

export interface ModeRule {
  /** Fewest active players the mode can start with (on top of the admin minimum). */
  minPlayers: number;
  /** Built and offered on /create. Modes still to come stay hidden. */
  available: boolean;
  /** Only in rooms where everyone is 18+ (player-written text, owner decision 2026-10-24). */
  adultOnly: boolean;
}

export const MODE_RULES: Readonly<Record<Mode, ModeRule>> = {
  classic: { minPlayers: 1, available: true, adultOnly: false },
  // With 2 players a room percentage would give away the other player's answer.
  room_percentage: { minPlayers: 3, available: true, adultOnly: false },
  // Averages of 2 ratings would give the other player's rating away, as with Room Percentage.
  hot_takes: { minPlayers: 3, available: true, adultOnly: false },
  // With 2 players every vote would name the only other player.
  most_likely: { minPlayers: 3, available: true, adultOnly: false },
  // A split of 2 answers would give the other player's answer away, so 3 like the others.
  red_green: { minPlayers: 3, available: true, adultOnly: false },
  rank_room: { minPlayers: 3, available: true, adultOnly: false },
  imposter: { minPlayers: 3, available: true, adultOnly: false },
  two_truths: { minPlayers: 3, available: true, adultOnly: false },
  who_said: { minPlayers: 3, available: true, adultOnly: true },
  spill_or_skip: { minPlayers: 3, available: true, adultOnly: false },
};

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** The players a mode needs to start: the admin minimum or the mode's own, whichever is more. */
export function modeMinPlayers(mode: Mode, adminMin: number): number {
  return Math.max(adminMin, MODE_RULES[mode].minPlayers);
}

/** Modes a room can pick: built, and adult-only ones only when everyone is 18 or older. */
/**
 * Games this host may start: built, adult-only ones for 18+ hosts only, and not switched off in
 * the admin console (`off`, owner request 2026-11-12).
 */
export function availableModes(floor: number, off: readonly string[] = []): Mode[] {
  return MODES.filter(
    (m) => MODE_RULES[m].available && (!MODE_RULES[m].adultOnly || floor >= 18) && !off.includes(m),
  );
}

/** Whether the guessing phase is about questions (each player guesses the room) not players. */
export function guessesQuestions(mode: Mode): boolean {
  return mode === "room_percentage" || mode === "hot_takes";
}

/** Hot Takes: players rate statements 0 to 100 instead of answering yes or no. */
export function ratesStatements(mode: Mode): boolean {
  return mode === "hot_takes";
}

export type PackFormat = "yes_no" | "statements" | "prompts" | "flags" | "pairs" | "open";

/** Most Likely To: players vote for a player on each prompt; there is no guessing phase. */
export function votesForPlayers(mode: Mode): boolean {
  return mode === "most_likely";
}

/** Red Flag, Green Flag: swipe scenarios green or red (stored as yes or no answers). */
export function swipesFlags(mode: Mode): boolean {
  return mode === "red_green";
}

/** Rank the Room: players put the whole room in order on each prompt. */
export function ranksPlayers(mode: Mode): boolean {
  return mode === "rank_room";
}

/**
 * Imposter: one secret player gets different questions; answers (0 to 100, from harmless pairs
 * packs) are shown to the room, and the guessing phase is a vote for the imposter.
 */
export function hasImposter(mode: Mode): boolean {
  return mode === "imposter";
}

/** Modes that answer each question with a 0 to 100 rating on the vessel. */
export function answersWithRatings(mode: Mode): boolean {
  return ratesStatements(mode) || hasImposter(mode);
}

/**
 * Two Truths and a Spill: yes or no answers, then each player picks a card of two truths and a
 * spill from their own answers, and the guessing phase spots the spill on each card.
 */
export function picksTruths(mode: Mode): boolean {
  return mode === "two_truths";
}

/**
 * Who Said That?: players write short answers (filtered), then guess who wrote each. 18+ rooms
 * only, and at most 5 prompts so the guessing stays quick.
 */
export function writesAnswers(mode: Mode): boolean {
  return mode === "who_said";
}

export const MAX_WRITTEN_PROMPTS = 5;

/** Spill or Skip: a classic round, then the room votes on the results for one story to hear. */
export function votesForStory(mode: Mode): boolean {
  return mode === "spill_or_skip";
}

/** Modes that play the classic round (answer, guess scores, reveal). */
export function playsClassic(mode: Mode): boolean {
  return mode === "classic" || votesForStory(mode);
}

/** Modes with no guessing phase: the room goes from answering straight to Lights down. */
export function skipsGuessing(mode: Mode): boolean {
  return votesForPlayers(mode) || swipesFlags(mode) || ranksPlayers(mode);
}

/** Modes that answer with the yes or no swipe (Red Flag, Green Flag reads it as green or red). */
export function answersYesNo(mode: Mode): boolean {
  return modeFormat(mode) === "yes_no" || swipesFlags(mode) || picksTruths(mode);
}

/** The kind of pack a mode plays: statements, prompts, scenarios, or yes or no questions. */
export function modeFormat(mode: Mode): PackFormat {
  if (ratesStatements(mode)) return "statements";
  if (swipesFlags(mode)) return "flags";
  if (hasImposter(mode)) return "pairs";
  if (writesAnswers(mode)) return "open";
  // Rank the Room plays the same prompt packs as Most Likely To.
  return votesForPlayers(mode) || ranksPlayers(mode) ? "prompts" : "yes_no";
}
