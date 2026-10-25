import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { freshState, requireMember, requirePhase, roomMode, spillStateFor } from "@/lib/api/rooms";
import { votesForStory } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { putSpillAnswer } from "@/lib/validation/schemas";

/** PUT /rooms/:code/spill-answer: the picked player tells the story or passes. Always allowed. */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putSpillAnswer);
  const room = await requireMember(code, userId);
  requirePhase(room.room, "revealed");
  if (!votesForStory(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  const { pick } = await spillStateFor(room.room, room.players, room.me.id);
  if (!pick || pick.playerId !== room.me.id) throw new ApiError("FORBIDDEN");

  const db = getAdminClient();
  const { error } = await db.rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "rating",
    p_inputs: [{ question_id: pick.questionId, value: body.spill ? 100 : 0 }],
  });
  if (error) throw fromDbError(error);
  await db.rpc("notify_room", { p_room: room.room.id, p_event: "spill_answer" });
  return freshState(code, userId);
});
