import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { ratesStatements } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putRatings } from "@/lib/validation/schemas";

/**
 * PUT /rooms/:code/ratings: Hot Takes ratings, 0 to 100, saved debounced by the client. Last write
 * wins per statement; the player's count is broadcast to the room like answers (SPIL-03).
 */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putRatings);
  const room = await requireMember(code, userId);
  await rateLimit("answers", room.me.id);
  requirePhase(room.room, "answering");
  if (!ratesStatements(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
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
  if (body.ratings.some((r) => !allowed.has(r.questionId))) throw new ApiError("UNKNOWN_QUESTION");

  const latest = new Map(body.ratings.map((r) => [r.questionId, r.value]));
  const { data, error } = await db.rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "rating",
    p_inputs: [...latest].map(([questionId, value]) => ({ question_id: questionId, value })),
  });
  if (error) throw fromDbError(error);
  return { saved: latest.size, answered: data as number };
});
