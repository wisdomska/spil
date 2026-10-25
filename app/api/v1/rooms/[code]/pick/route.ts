import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { picksTruths, validPick, type AnswerValue } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putPick } from "@/lib/validation/schemas";

/**
 * PUT /rooms/:code/pick: Two Truths card, chosen by the player from their own answers: two they
 * said yes to and one they said no to. Only what the player picks is ever shown.
 */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putPick);
  const room = await requireMember(code, userId);
  await rateLimit("answers", room.me.id);
  requirePhase(room.room, "answering");
  if (!picksTruths(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  if (room.me.status !== "active") throw new ApiError("WRONG_PHASE");
  if (room.me.answers_submitted_at) throw new ApiError("ALREADY_SUBMITTED");

  const db = getAdminClient();
  const { data: mine, error: mineError } = await db
    .from("answers")
    .select("question_id, value")
    .eq("player_id", room.me.id)
    .eq("round", room.room.round);
  if (mineError) throw fromDbError(mineError);
  const answers = Object.fromEntries(
    (mine ?? []).map((a) => [a.question_id, a.value as AnswerValue]),
  );
  if (!validPick(answers, body)) throw new ApiError("INVALID_PICK");

  const { error } = await db.rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "pick",
    p_inputs: [
      ...body.truths.map((q) => ({ question_id: q, value: 1 })),
      { question_id: body.spill, value: 0 },
    ],
  });
  if (error) throw fromDbError(error);
  return { saved: 3 };
});
