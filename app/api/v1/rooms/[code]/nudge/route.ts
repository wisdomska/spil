import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireHost, requireMember, requirePhase } from "@/lib/api/rooms";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { playerTarget } from "@/lib/validation/schemas";

/** POST /rooms/:code/nudge: host shakes a slow player's phone. Once per target per minute. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const { playerId } = await readBody(request, playerTarget);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "answering", "guessing");
  const target = room.players.find((p) => p.id === playerId && p.status === "active");
  if (!target || target.id === room.me.id) throw new ApiError("PLAYER_NOT_FOUND");
  await rateLimit("nudge", `${room.room.id}:${playerId}`);
  const { error } = await getAdminClient().rpc("nudge", {
    p_room: room.room.id,
    p_target: playerId,
  });
  if (error) throw fromDbError(error);
  return {};
});
