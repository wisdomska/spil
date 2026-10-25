import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember, requirePhase, roomMode, truthsCardsFor } from "@/lib/api/rooms";
import { picksTruths } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putSpots } from "@/lib/validation/schemas";

/** PUT /rooms/:code/spots: Two Truths spots, one per card (never your own). */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putSpots);
  const room = await requireMember(code, userId);
  await rateLimit("guesses", room.me.id);
  requirePhase(room.room, "guessing");
  if (!picksTruths(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  if (room.me.guesses_submitted_at) throw new ApiError("ALREADY_SUBMITTED");
  const cards = new Map(
    (await truthsCardsFor(room.room, room.players))
      .filter((c) => c.playerId !== room.me.id)
      .map((c) => [c.playerId, new Set(c.items.map((i) => i.questionId))]),
  );
  if (body.spots.some((s) => !cards.get(s.targetId)?.has(s.questionId)))
    throw new ApiError("INVALID_TARGET");

  const latest = new Map(body.spots.map((s) => [s.targetId, s.questionId]));
  const { error } = await getAdminClient().rpc("save_mode_inputs", {
    p_player: room.me.id,
    p_room: room.room.id,
    p_round: room.room.round,
    p_kind: "spot",
    p_inputs: [...latest].map(([targetId, questionId]) => ({
      target_id: targetId,
      question_id: questionId,
    })),
  });
  if (error) throw fromDbError(error);
  return { saved: latest.size };
});
