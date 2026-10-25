import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { isScoredPlayer, requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { hasImposter } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putSuspect } from "@/lib/validation/schemas";

/** PUT /rooms/:code/suspect: Imposter vote, one per player, for anyone else in the game. */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putSuspect);
  const room = await requireMember(code, userId);
  await rateLimit("guesses", room.me.id);
  requirePhase(room.room, "guessing");
  if (!hasImposter(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  if (room.me.guesses_submitted_at) throw new ApiError("ALREADY_SUBMITTED");
  const others = new Set(
    room.players.filter((p) => isScoredPlayer(p) && p.id !== room.me.id).map((p) => p.id),
  );
  if (!others.has(body.targetId)) throw new ApiError("INVALID_TARGET");

  const { error } = await getAdminClient().rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "vote",
    p_inputs: [{ target_id: body.targetId }],
  });
  if (error) throw fromDbError(error);
  return { saved: 1 };
});
