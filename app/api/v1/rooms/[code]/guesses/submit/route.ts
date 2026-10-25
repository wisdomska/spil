import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import {
  freshState,
  isScoredPlayer,
  mySpots,
  percentTargets,
  truthsCardsFor,
  roomMode,
  loadPlayers,
  advancePhaseIfReady,
  requireMember,
  requirePhase,
} from "@/lib/api/rooms";
import { guessesQuestions, hasImposter, picksTruths } from "@/lib/game";
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
  if (picksTruths(roomMode(room.room))) {
    const [cards, spots] = await Promise.all([
      truthsCardsFor(room.room, room.players),
      mySpots(room.room, room.me.id),
    ]);
    if (cards.some((c) => c.playerId !== room.me.id && !spots[c.playerId]))
      throw new ApiError("INCOMPLETE");
    await db
      .from("players")
      .update({ guesses_submitted_at: new Date().toISOString() })
      .eq("id", room.me.id)
      .is("guesses_submitted_at", null);
    await advancePhaseIfReady(room.room, await loadPlayers(room.room.id));
    return freshState(code, userId);
  }
  if (hasImposter(roomMode(room.room))) {
    // Imposter: the vote is the whole guessing phase.
    const { data: vote, error: voteError } = await db
      .from("mode_inputs")
      .select("id")
      .eq("player_id", room.me.id)
      .eq("round", room.room.round)
      .eq("kind", "vote")
      .is("question_id", null)
      .limit(1);
    if (voteError) throw fromDbError(voteError);
    if (!vote?.length) throw new ApiError("INCOMPLETE");
    await db
      .from("players")
      .update({ guesses_submitted_at: new Date().toISOString() })
      .eq("id", room.me.id)
      .is("guesses_submitted_at", null);
    await advancePhaseIfReady(room.room, await loadPlayers(room.room.id));
    return freshState(code, userId);
  }
  if (guessesQuestions(roomMode(room.room))) {
    const [targets, { data: mine, error: mineError }] = await Promise.all([
      percentTargets(room.room, room.players),
      db
        .from("mode_inputs")
        .select("question_id")
        .eq("player_id", room.me.id)
        .eq("round", room.room.round)
        .eq("kind", "percent"),
    ]);
    if (mineError) throw fromDbError(mineError);
    const have = new Set((mine ?? []).map((m) => m.question_id));
    if (targets.some((q) => !have.has(q.id))) throw new ApiError("INCOMPLETE");
    await db
      .from("players")
      .update({ guesses_submitted_at: new Date().toISOString() })
      .eq("id", room.me.id)
      .is("guesses_submitted_at", null);
    await advancePhaseIfReady(room.room, await loadPlayers(room.room.id));
    return freshState(code, userId);
  }
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

  await advancePhaseIfReady(room.room, await loadPlayers(room.room.id));
  return freshState(code, userId);
});
