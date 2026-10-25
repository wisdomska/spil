import "server-only";
import {
  achievements,
  EMPTY_STATS,
  isFrame,
  isLook,
  unlocked,
  type AchievementState,
  type FrameId,
  type LookId,
  type PlayerStats,
} from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { ApiError, fromDbError } from "./errors";

const db = () => getAdminClient();

export type Badges = {
  stats: PlayerStats;
  achievements: AchievementState[];
  frames: FrameId[];
  looks: LookId[];
  equipped: { frame: FrameId; look: LookId };
};

async function statsFor(
  userId: string,
): Promise<{ stats: PlayerStats; frame: FrameId; look: LookId }> {
  const [row, crews, dailies] = await Promise.all([
    db().from("player_stats").select("*").eq("user_id", userId).maybeSingle(),
    db()
      .from("crew_members")
      .select("crew_id", { count: "exact", head: true })
      .eq("user_id", userId),
    db().from("daily_answers").select("day", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (row.error) throw fromDbError(row.error);
  const r = row.data;
  return {
    stats: {
      ...EMPTY_STATS,
      ...(r
        ? {
            games: r.games,
            wins: r.wins,
            bullseyes: r.bullseyes,
            hosted: r.hosted,
            points: r.points,
            modes: r.modes.length,
          }
        : {}),
      crews: crews.count ?? 0,
      dailies: dailies.count ?? 0,
    },
    frame: isFrame(r?.frame) ? r.frame : "none",
    look: isLook(r?.look) ? r.look : "night",
  };
}

export async function myBadges(userId: string): Promise<Badges> {
  const { stats, frame, look } = await statsFor(userId);
  const states = achievements(stats);
  const open = unlocked(states);
  // A frame or look that is no longer unlocked falls back to the default.
  return {
    stats,
    achievements: states,
    ...open,
    equipped: {
      frame: open.frames.includes(frame) ? frame : "none",
      look: open.looks.includes(look) ? look : "night",
    },
  };
}

/** Wear a frame or use a card look, if it is unlocked. */
export async function setCosmetics(userId: string, choice: { frame?: string; look?: string }) {
  const badges = await myBadges(userId);
  if (
    choice.frame !== undefined &&
    !(isFrame(choice.frame) && badges.frames.includes(choice.frame))
  )
    throw new ApiError("BAD_REQUEST", "That frame is still locked.");
  if (choice.look !== undefined && !(isLook(choice.look) && badges.looks.includes(choice.look)))
    throw new ApiError("BAD_REQUEST", "That look is still locked.");
  const { error } = await db()
    .from("player_stats")
    .upsert(
      {
        user_id: userId,
        frame: (choice.frame as FrameId | undefined) ?? badges.equipped.frame,
        look: (choice.look as LookId | undefined) ?? badges.equipped.look,
      },
      { onConflict: "user_id" },
    );
  if (error) throw fromDbError(error);
  return myBadges(userId);
}

/** The frame each of these users wears (for the room roster). */
export async function framesFor(userIds: string[]): Promise<Map<string, FrameId>> {
  if (!userIds.length) return new Map();
  const { data } = await db().from("player_stats").select("user_id, frame").in("user_id", userIds);
  return new Map(
    (data ?? [])
      .filter((r) => isFrame(r.frame) && r.frame !== "none")
      .map((r) => [r.user_id, r.frame as FrameId]),
  );
}
