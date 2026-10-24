import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { percentTargets, requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { guessesQuestions } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putPercent } from "@/lib/validation/schemas";

/**
 * PUT /rooms/:code/percent: Room Percentage guesses of the room's yes share, saved debounced by
 * the client. Only questions 3 or more people answered can be guessed.
 */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putPercent);
  const room = await requireMember(code, userId);
  await rateLimit("guesses", room.me.id);
  requirePhase(room.room, "guessing");
  if (!guessesQuestions(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  if (room.me.guesses_submitted_at) throw new ApiError("ALREADY_SUBMITTED");
  const allowed = new Set((await percentTargets(room.room, room.players)).map((q) => q.id));
  if (body.guesses.some((g) => !allowed.has(g.questionId))) throw new ApiError("UNKNOWN_QUESTION");

  const latest = new Map(body.guesses.map((g) => [g.questionId, g.value]));
  const { data, error } = await getAdminClient().rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "percent",
    p_inputs: [...latest].map(([questionId, value]) => ({ question_id: questionId, value })),
  });
  if (error) throw fromDbError(error);
  return { saved: latest.size, total: data as number };
});
