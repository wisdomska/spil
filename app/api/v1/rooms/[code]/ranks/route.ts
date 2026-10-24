import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { isScoredPlayer, requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { ranksPlayers } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putRanks } from "@/lib/validation/schemas";

/**
 * PUT /rooms/:code/ranks: Rank the Room orders, one per prompt, each the whole room (yourself
 * included) exactly once. A new order replaces the old one; progress is broadcast like answers.
 */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putRanks);
  const room = await requireMember(code, userId);
  await rateLimit("answers", room.me.id);
  requirePhase(room.room, "answering");
  if (!ranksPlayers(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
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
  if (body.ranks.some((r) => !allowed.has(r.questionId))) throw new ApiError("UNKNOWN_QUESTION");
  // Each order is everyone still in the game, each once.
  const everyone = new Set(room.players.filter(isScoredPlayer).map((p) => p.id));
  const complete = (order: string[]) =>
    order.length === everyone.size &&
    new Set(order).size === order.length &&
    order.every((id) => everyone.has(id));
  if (body.ranks.some((r) => !complete(r.order))) throw new ApiError("INVALID_TARGET");

  const latest = new Map(body.ranks.map((r) => [r.questionId, r.order]));
  const { data, error } = await db.rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "rank",
    p_inputs: [...latest].flatMap(([questionId, order]) =>
      order.map((targetId, i) => ({ question_id: questionId, target_id: targetId, value: i + 1 })),
    ),
  });
  if (error) throw fromDbError(error);
  return { saved: latest.size, answered: data as number };
});
