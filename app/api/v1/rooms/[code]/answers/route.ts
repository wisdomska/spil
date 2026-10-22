import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember, requirePhase } from "@/lib/api/rooms";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putAnswers } from "@/lib/validation/schemas";

/** PUT /rooms/:code/answers: saves a batch of answers (offline queue flushes here). Idempotent. */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putAnswers);
  const room = await requireMember(code, userId);
  await rateLimit("answers", room.me.id);
  requirePhase(room.room, "answering");
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
  if (body.answers.some((a) => !allowed.has(a.questionId))) throw new ApiError("UNKNOWN_QUESTION");

  // Last write wins per question, so a batch may carry a corrected answer.
  const rows = new Map(body.answers.map((a) => [a.questionId, a.value]));
  const { error } = await db.from("answers").upsert(
    [...rows].map(([questionId, value]) => ({
      player_id: room.me.id,
      room_id: room.room.id,
      round: room.room.round,
      question_id: questionId,
      value,
      updated_at: new Date().toISOString(),
    })),
  );
  if (error) throw fromDbError(error);
  return { saved: rows.size };
});
