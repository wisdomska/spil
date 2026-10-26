import { availableModes, modeFormat, type Mode, type PackFormat } from "./modes";

/**
 * Game setup in two steps (owner request 2026-10-26): pick a game, then a pack only when the
 * game has more than one. Pure, so the rules are tested here.
 */

/** The classic leads the page; the rest sit in three groups by how they feel to play. */
export const FEATURED_MODE = "classic" as const satisfies Mode;
export const MODE_GROUPS = [
  { id: "guess", modes: ["room_percentage", "hot_takes"] },
  { id: "vote", modes: ["most_likely", "rank_room", "red_green"] },
  { id: "bluff", modes: ["imposter", "two_truths", "who_said"] },
] as const satisfies ReadonlyArray<{ id: string; modes: readonly Mode[] }>;
export type ModeGroupId = (typeof MODE_GROUPS)[number]["id"];

/**
 * Spill or Skip is the classic game plus a story vote at the end, so it is a switch on the
 * classic pack step rather than a card of its own.
 */
export const STORY_VOTE_MODE = "spill_or_skip" as const satisfies Mode;
export function withStoryVote(mode: Mode, on: boolean): Mode {
  if (mode !== FEATURED_MODE && mode !== STORY_VOTE_MODE) return mode;
  return on ? STORY_VOTE_MODE : FEATURED_MODE;
}

type SetupPack = { id: string; format: PackFormat; locked?: boolean };

/** Packs this game can play right now (premium packs locked by the payments flag are left out). */
export function packsForMode<P extends SetupPack>(packs: readonly P[], mode: Mode): P[] {
  const format = modeFormat(mode);
  return packs.filter((p) => p.format === format && !p.locked);
}

export type SetupPath =
  { kind: "start"; packId: string } | { kind: "choose"; packs: number } | { kind: "none" };

/**
 * What tapping a game does: start straight away when exactly one pack fits, open the pack step
 * when several do, and nothing when none does (the card is shown as unavailable). Decided from
 * the packs this player may see, so a new pack or a younger band changes it by itself.
 */
export function setupPath(packs: readonly SetupPack[], mode: Mode): SetupPath {
  const fit = packsForMode(packs, mode);
  if (fit.length === 1) return { kind: "start", packId: fit[0]!.id };
  if (fit.length > 1) return { kind: "choose", packs: fit.length };
  return { kind: "none" };
}

/** The games shown in step 1 for this age floor, in page order (featured first). */
export function setupModes(floor: number): {
  featured: Mode | null;
  groups: Array<{ id: ModeGroupId; modes: Mode[] }>;
} {
  const allowed = new Set(availableModes(floor));
  return {
    featured: allowed.has(FEATURED_MODE) ? FEATURED_MODE : null,
    groups: MODE_GROUPS.map((g) => ({
      id: g.id,
      modes: (g.modes as readonly Mode[]).filter((m) => allowed.has(m)),
    })).filter((g) => g.modes.length > 0),
  };
}

/** Reads a game from the URL; only games this player may play count. */
export function parseSetupMode(raw: string | null, floor: number): Mode | null {
  return raw && (availableModes(floor) as string[]).includes(raw) ? (raw as Mode) : null;
}

/** SPIL-08: 5 · 10 · 15 · 20 · All. */
const COUNT_OPTIONS = [5, 10, 15, 20];

/** Length options under the pack's size, plus "All n" (App: qnOpts). */
export function countOptions(total: number) {
  return [...new Set([...COUNT_OPTIONS.filter((n) => n < total), total])].filter((n) => n > 0);
}

/** The length a game starts with: the admin default, or the nearest the pack allows. */
export function defaultCount(total: number, perGame: number) {
  const opts = countOptions(total);
  return opts.find((n) => n >= perGame) ?? opts[opts.length - 1] ?? 0;
}
