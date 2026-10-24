import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { botName, freshState, requireHost, requireMember, requirePhase } from "@/lib/api/rooms";
import { getFlags, getSettings } from "@/lib/flags";
import { randomRotationSeed } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { testPlayers } from "@/lib/validation/schemas";

/** POST /rooms/:code/test-players: dev and staging only. Bots answer and guess on their own. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const { count } = await readBody(request, testPlayers);
  const flags = await getFlags();
  if (!flags.test_players) throw new ApiError("FORBIDDEN", "Test players are off here.");

  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "lobby");
  const settings = await getSettings();
  const active = room.players.filter((p) => p.status === "active");
  const room_left = settings.maxPlayers - active.length;
  if (room_left <= 0) throw new ApiError("ROOM_FULL");

  const taken = room.players.filter((p) => p.status === "active").map((p) => p.nickname);
  const rows = Array.from({ length: Math.min(count, room_left) }, () => {
    const nickname = botName(taken);
    taken.push(nickname);
    return {
      room_id: room.room.id,
      user_id: crypto.randomUUID(),
      nickname,
      avatar: Math.floor(Math.random() * 24),
      rotation_seed: randomRotationSeed(),
      // Test players never hold a room back on age (dev and staging only).
      age_band: "18_plus" as const,
      is_bot: true,
      spill_mode: Math.random() < 0.5,
    };
  });
  const { error } = await getAdminClient().from("players").insert(rows);
  if (error) throw fromDbError(error);
  return freshState(code, userId);
});
