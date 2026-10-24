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
  most_likely: { minPlayers: 3, available: false, adultOnly: false },
  red_green: { minPlayers: 2, available: false, adultOnly: false },
  rank_room: { minPlayers: 3, available: false, adultOnly: false },
  imposter: { minPlayers: 3, available: false, adultOnly: false },
  two_truths: { minPlayers: 3, available: false, adultOnly: false },
  who_said: { minPlayers: 3, available: false, adultOnly: true },
  spill_or_skip: { minPlayers: 3, available: false, adultOnly: false },
};

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** The players a mode needs to start: the admin minimum or the mode's own, whichever is more. */
export function modeMinPlayers(mode: Mode, adminMin: number): number {
  return Math.max(adminMin, MODE_RULES[mode].minPlayers);
}

/** Modes a room can pick: built, and adult-only ones only when everyone is 18 or older. */
export function availableModes(floor: number): Mode[] {
  return MODES.filter((m) => MODE_RULES[m].available && (!MODE_RULES[m].adultOnly || floor >= 18));
}

/** Whether the guessing phase is about questions (each player guesses the room) not players. */
export function guessesQuestions(mode: Mode): boolean {
  return mode === "room_percentage" || mode === "hot_takes";
}

/** Hot Takes: players rate statements 0 to 100 instead of answering yes or no. */
export function ratesStatements(mode: Mode): boolean {
  return mode === "hot_takes";
}

export type PackFormat = "yes_no" | "statements";

/** The kind of pack a mode plays: statements for Hot Takes, yes or no questions otherwise. */
export function modeFormat(mode: Mode): PackFormat {
  return ratesStatements(mode) ? "statements" : "yes_no";
}
