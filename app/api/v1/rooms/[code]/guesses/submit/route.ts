import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import {
  freshState,
  isScoredPlayer,
  loadPlayers,
  maybeAdvance,
  requireMember,
  requirePhase,
} from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";

/** POST /rooms/:code/guesses/submit: locks guesses. Needs one guess per other scored player. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  requirePhase(room.room, "guessing");
  if (room.me.guesses_submitted_at) return freshState(code, userId);
  // Players who sat out answering can still guess ("They can still guess.").

  const db = getAdminClient();
  const { data, error } = await db
    .from("guesses")
    .select("target_id")
    .eq("guesser_id", room.me.id)
    .eq("round", room.room.round);
  if (error) throw fromDbError(error);
  const have = new Set((data ?? []).map((g) => g.target_id));
  const needed = room.players.filter((p) => isScoredPlayer(p) && p.id !== room.me.id);
  if (needed.some((p) => !have.has(p.id))) throw new ApiError("INCOMPLETE");

  await db
    .from("players")
    .update({ guesses_submitted_at: new Date().toISOString() })
    .eq("id", room.me.id)
    .is("guesses_submitted_at", null);

  await maybeAdvance(room.room, await loadPlayers(room.room.id));
  return freshState(code, userId);
});
