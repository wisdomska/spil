import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { freshState, requireMember, requirePhase, roomMode, spillStateFor } from "@/lib/api/rooms";
import { isSpillOption, votesForStory } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putSpillVote } from "@/lib/validation/schemas";

/**
 * PUT /rooms/:code/spill-vote: Spill or Skip, after the reveal. Vote for one Spill Mode player's
 * yes to hear the story behind, or skip. One vote per player; every phone refreshes.
 */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putSpillVote);
  const room = await requireMember(code, userId);
  await rateLimit("guesses", room.me.id);
  requirePhase(room.room, "revealed");
  if (!votesForStory(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  const vote =
    "skip" in body ? ("skip" as const) : { questionId: body.questionId, playerId: body.targetId };
  const { options } = await spillStateFor(room.room, room.players, room.me.id);
  if (!isSpillOption(options, vote)) throw new ApiError("INVALID_TARGET");

  const db = getAdminClient();
  const { error } = await db.rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "pick",
    p_inputs: [
      vote === "skip"
        ? { value: 0 }
        : { question_id: vote.questionId, target_id: vote.playerId, value: 1 },
    ],
  });
  if (error) throw fromDbError(error);
  await db.rpc("notify_room", { p_room: room.room.id, p_event: "spill_vote" });
  return freshState(code, userId);
});
