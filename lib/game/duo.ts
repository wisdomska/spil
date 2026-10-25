/**
 * Duo results (SPIL-23): a classic round with exactly two scored players gets a "how well you
 * know each other" percentage and one duo award instead of the room awards (which start at 3).
 * Pure, so the rule is tested here; the server sends the result, clients only show it.
 */
export type DuoAward = "soulmates" | "getting_there" | "work_in_progress";

export interface DuoPlayer {
  playerId: string;
  score: number;
  /** What the other player guessed about this one. */
  avgGuessAbout: number;
  /** How many guessed about this player; a duo needs both to have been guessed. */
  guessedBy?: number;
}

export interface DuoResult {
  /** 100 minus the average of both guess errors, 0 to 100. */
  pct: number;
  award: DuoAward;
  /** Each player's guess error, in the order given. */
  errors: [number, number];
}

export const DUO_CLOSE = 5;
export const DUO_NEAR = 15;

export function duoResult(players: readonly DuoPlayer[]): DuoResult | null {
  if (players.length !== 2 || players.some((p) => !p.guessedBy)) return null;
  const errors = players.map((p) => Math.abs(p.avgGuessAbout - p.score)) as [number, number];
  const pct = Math.max(0, Math.min(100, Math.round(100 - (errors[0] + errors[1]) / 2)));
  const award: DuoAward = errors.every((e) => e <= DUO_CLOSE)
    ? "soulmates"
    : errors.every((e) => e <= DUO_NEAR)
      ? "getting_there"
      : "work_in_progress";
  return { pct, award, errors };
}
