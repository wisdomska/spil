import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { freshState, requireHost, requireMember, requirePhase } from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";
import { playerTarget } from "@/lib/validation/schemas";

/** POST /rooms/:code/kick: host removes a player from the lobby. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const { playerId } = await readBody(request, playerTarget);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "lobby");
  const target = room.players.find((p) => p.id === playerId);
  if (!target || target.id === room.me.id || target.status !== "active")
    throw new ApiError("PLAYER_NOT_FOUND");
  const { error } = await getAdminClient()
    .from("players")
    .update({ status: "removed" })
    .eq("id", playerId);
  if (error) throw fromDbError(error);
  return freshState(code, userId);
});
