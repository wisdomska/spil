/**
 * Achievements and cosmetics (Batch 3, free): badges for milestones, kept per device session, and
 * the avatar frames and share card looks they unlock. Pure, so the rules are tested here.
 */
export interface PlayerStats {
  games: number;
  wins: number;
  bullseyes: number;
  hosted: number;
  points: number;
  /** Distinct game modes played. */
  modes: number;
  crews: number;
  dailies: number;
}

export const EMPTY_STATS: PlayerStats = {
  games: 0,
  wins: 0,
  bullseyes: 0,
  hosted: 0,
  points: 0,
  modes: 0,
  crews: 0,
  dailies: 0,
};

export const ACHIEVEMENTS = [
  { id: "first_spill", stat: "games", target: 1 },
  { id: "regular", stat: "games", target: 10 },
  { id: "veteran", stat: "games", target: 50 },
  { id: "first_win", stat: "wins", target: 1 },
  { id: "champion", stat: "wins", target: 10 },
  { id: "bullseye", stat: "bullseyes", target: 1 },
  { id: "sharpshooter", stat: "bullseyes", target: 10 },
  { id: "mind_reader", stat: "points", target: 250 },
  { id: "party_starter", stat: "hosted", target: 5 },
  { id: "explorer", stat: "modes", target: 5 },
  { id: "game_master", stat: "modes", target: 10 },
  { id: "crew_up", stat: "crews", target: 1 },
  { id: "daily_habit", stat: "dailies", target: 7 },
] as const satisfies ReadonlyArray<{ id: string; stat: keyof PlayerStats; target: number }>;

export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

export interface AchievementState {
  id: AchievementId;
  unlocked: boolean;
  /** Progress towards the target, capped at it. */
  progress: number;
  target: number;
}

export function achievements(stats: PlayerStats): AchievementState[] {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    target: a.target,
    progress: Math.min(stats[a.stat], a.target),
    unlocked: stats[a.stat] >= a.target,
  }));
}

/** Avatar frames, drawn from the colour tokens. "none" is always yours. */
export const FRAMES = [
  { id: "none", unlock: null },
  { id: "ring", unlock: "first_spill" },
  { id: "accent", unlock: "first_win" },
  { id: "dashed", unlock: "explorer" },
  { id: "double", unlock: "champion" },
] as const satisfies ReadonlyArray<{ id: string; unlock: AchievementId | null }>;
export type FrameId = (typeof FRAMES)[number]["id"];

/** Share card looks; all stay in the dark theme. "night" is always yours. */
export const LOOKS = [
  { id: "night", unlock: null },
  { id: "raised", unlock: "regular" },
  { id: "accent", unlock: "mind_reader" },
] as const satisfies ReadonlyArray<{ id: string; unlock: AchievementId | null }>;
export type LookId = (typeof LOOKS)[number]["id"];

export function isFrame(v: unknown): v is FrameId {
  return FRAMES.some((f) => f.id === v);
}
export function isLook(v: unknown): v is LookId {
  return LOOKS.some((l) => l.id === v);
}

/** Which cosmetics a player has unlocked. */
export function unlocked(states: readonly AchievementState[]) {
  const have = new Set(states.filter((s) => s.unlocked).map((s) => s.id));
  const open = (u: AchievementId | null) => u === null || have.has(u);
  return {
    frames: FRAMES.filter((f) => open(f.unlock)).map((f) => f.id as FrameId),
    looks: LOOKS.filter((l) => open(l.unlock)).map((l) => l.id as LookId),
  };
}

/** What one round adds to a player's stats. */
export function roundStats(input: {
  rank: number;
  points: number;
  bullseyes: number;
  hosted: boolean;
  players: number;
}): Pick<PlayerStats, "games" | "wins" | "bullseyes" | "hosted" | "points"> {
  return {
    games: 1,
    // A win needs someone to beat and some points.
    wins: input.rank === 1 && input.players > 1 && input.points > 0 ? 1 : 0,
    bullseyes: input.bullseyes,
    hosted: input.hosted ? 1 : 0,
    points: input.points,
  };
}
