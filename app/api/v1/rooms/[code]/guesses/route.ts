import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { isScoredPlayer, requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { playsClassic } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putGuesses } from "@/lib/validation/schemas";

/** PUT /rooms/:code/guesses: saves guesses about other players (debounced by the client). */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putGuesses);
  const room = await requireMember(code, userId);
  await rateLimit("guesses", room.me.id);
  requirePhase(room.room, "guessing");
  // Only the classic round guesses about players; the other modes have their own inputs.
  if (!playsClassic(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  if (room.me.guesses_submitted_at) throw new ApiError("ALREADY_SUBMITTED");

  const targets = new Set(room.players.filter(isScoredPlayer).map((p) => p.id));
  if (body.guesses.some((g) => g.targetId === room.me.id || !targets.has(g.targetId)))
    throw new ApiError("INVALID_TARGET");

  const rows = new Map(body.guesses.map((g) => [g.targetId, g.value]));
  const { error } = await getAdminClient()
    .from("guesses")
    .upsert(
      [...rows].map(([targetId, value]) => ({
        guesser_id: room.me.id,
        target_id: targetId,
        room_id: room.room.id,
        round: room.room.round,
        value,
        updated_at: new Date().toISOString(),
      })),
    );
  if (error) throw fromDbError(error);
  return { saved: rows.size };
});
