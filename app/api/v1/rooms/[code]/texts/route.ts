import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { writesAnswers } from "@/lib/game";
import { filterText } from "@/lib/moderation/filter";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putTexts } from "@/lib/validation/schemas";

/**
 * PUT /rooms/:code/texts: Who Said That? answers. Every answer goes through the text filter
 * first: slurs and contact details are refused, swear words masked. Returns the saved text.
 */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putTexts);
  const room = await requireMember(code, userId);
  await rateLimit("answers", room.me.id);
  requirePhase(room.room, "answering");
  if (!writesAnswers(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
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
  if (body.texts.some((t) => !allowed.has(t.questionId))) throw new ApiError("UNKNOWN_QUESTION");

  const saved: Record<string, string> = {};
  for (const t of body.texts) {
    const result = filterText(t.body);
    if (!result.ok)
      throw new ApiError(
        result.reason === "blocked"
          ? "TEXT_BLOCKED"
          : result.reason === "contact"
            ? "TEXT_CONTACT"
            : "TEXT_EMPTY",
      );
    saved[t.questionId] = result.text;
  }
  const { error } = await db.rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "text",
    p_inputs: Object.entries(saved).map(([questionId, text]) => ({
      question_id: questionId,
      body: text,
    })),
  });
  if (error) throw fromDbError(error);
  return { saved };
});
