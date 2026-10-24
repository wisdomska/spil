import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { isScoredPlayer, requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { votesForPlayers } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putVotes } from "@/lib/validation/schemas";

/**
 * PUT /rooms/:code/votes: Most Likely To votes, one per prompt, for another player still in the
 * game. A new vote on a prompt replaces the old one; the count is broadcast like answers.
 */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putVotes);
  const room = await requireMember(code, userId);
  await rateLimit("answers", room.me.id);
  requirePhase(room.room, "answering");
  if (!votesForPlayers(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  if (room.me.status !== "active") throw new ApiError("WRONG_PHASE");
  if (room.me.answers_submitted_at) throw new ApiError("ALREADY_SUBMITTED");

  const db = getAdminClient();
  const { data: drawn, error: drawnError } = await db
    .from("room_questions")
    .select("question_id")
    .eq("room_id", room.room.id)
    .eq("round", room.room.round);
  if (drawnError) throw fromDbError(drawnError);
  const allowed = new Set((drawn ?? []).map((q) => q.question_id));
  if (body.votes.some((v) => !allowed.has(v.questionId))) throw new ApiError("UNKNOWN_QUESTION");
  const candidates = new Set(
    room.players.filter((p) => isScoredPlayer(p) && p.id !== room.me.id).map((p) => p.id),
  );
  if (body.votes.some((v) => !candidates.has(v.targetId))) throw new ApiError("INVALID_TARGET");

  const latest = new Map(body.votes.map((v) => [v.questionId, v.targetId]));
  const { data, error } = await db.rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "vote",
    p_inputs: [...latest].map(([questionId, targetId]) => ({
      question_id: questionId,
      target_id: targetId,
    })),
  });
  if (error) throw fromDbError(error);
  return { saved: latest.size, answered: data as number };
});
