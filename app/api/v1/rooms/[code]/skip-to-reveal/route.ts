import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import {
  advancePhaseIfReady,
  freshState,
  loadPlayers,
  requireHost,
  requireMember,
  requirePhase,
} from "@/lib/api/rooms";
import { canSkipToReveal } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * POST /rooms/:code/skip-to-reveal: host escape hatch once guessing has run 60 s (SPIL-01).
 * Locks everyone still guessing with the guesses they have, then the room moves to ready.
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "guessing");
  if (!canSkipToReveal({ status: room.room.status, guessingAt: room.room.guessing_at }, Date.now()))
    throw new ApiError("TOO_EARLY");

  const { error } = await getAdminClient()
    .from("players")
    .update({ guesses_submitted_at: new Date().toISOString() })
    .eq("room_id", room.room.id)
    .in("status", ["active", "sat_out"])
    .is("guesses_submitted_at", null);
  if (error) throw fromDbError(error);

  await advancePhaseIfReady(room.room, await loadPlayers(room.room.id));
  return freshState(code, userId);
});
