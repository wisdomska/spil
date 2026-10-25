import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import {
  autoplayBots,
  freshState,
  loadPlayers,
  advancePhaseIfReady,
  myRanks,
  myRatings,
  myVotes,
  requireMember,
  requirePhase,
  roomMode,
} from "@/lib/api/rooms";
import {
  checkAnswerSubmission,
  ranksPlayers,
  answersWithRatings,
  canMakeCard,
  picksTruths,
  validPick,
  votesForPlayers,
  type AnswerValue,
} from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

/** POST /rooms/:code/answers/submit: locks the caller's answers; the last one in opens guessing. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  requirePhase(room.room, "answering");
  if (room.me.answers_submitted_at) return freshState(code, userId);
  if (room.me.status !== "active") throw new ApiError("WRONG_PHASE");

  const db = getAdminClient();
  const [drawn, answers] = await Promise.all([
    db
      .from("room_questions")
      .select("question_id")
      .eq("room_id", room.room.id)
      .eq("round", room.room.round),
    db
      .from("answers")
      .select("question_id, value")
      .eq("player_id", room.me.id)
      .eq("round", room.room.round),
  ]);
  if (drawn.error) throw fromDbError(drawn.error);
  if (answers.error) throw fromDbError(answers.error);

  const mode = roomMode(room.room);
  if (answersWithRatings(mode) || votesForPlayers(mode) || ranksPlayers(mode)) {
    // Hot Takes rates every statement; Most Likely To and Rank the Room cover every prompt.
    const given = answersWithRatings(mode)
      ? await myRatings(room.room, room.me.id)
      : votesForPlayers(mode)
        ? await myVotes(room.room, room.me.id)
        : await myRanks(room.room, room.me.id);
    if ((drawn.data ?? []).some((q) => !(q.question_id in given))) throw new ApiError("INCOMPLETE");
  } else {
    const mine = Object.fromEntries(
      (answers.data ?? []).map((a) => [a.question_id, a.value as AnswerValue]),
    );
    const check = checkAnswerSubmission(
      mine,
      (drawn.data ?? []).map((q) => q.question_id),
    );
    if (!check.ok) throw new ApiError(check.code);
    // Two Truths: a card is needed from anyone with 2 yes answers and 1 no.
    if (picksTruths(mode) && canMakeCard(mine)) {
      const { data: card, error: cardError } = await db
        .from("mode_inputs")
        .select("question_id, value")
        .eq("player_id", room.me.id)
        .eq("round", room.room.round)
        .eq("kind", "pick");
      if (cardError) throw fromDbError(cardError);
      const pick = {
        truths: (card ?? []).filter((c) => c.value === 1).map((c) => c.question_id!),
        spill: (card ?? []).find((c) => c.value === 0)?.question_id ?? "",
      };
      if (!validPick(mine, pick)) throw new ApiError("INCOMPLETE");
    }
  }

  await db
    .from("players")
    .update({ answers_submitted_at: new Date().toISOString() })
    .eq("id", room.me.id)
    .is("answers_submitted_at", null);

  const advanced = await advancePhaseIfReady(room.room, await loadPlayers(room.room.id));
  if (advanced.status === "guessing") await autoplayBots(advanced);
  return freshState(code, userId);
});
