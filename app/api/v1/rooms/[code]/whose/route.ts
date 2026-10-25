import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { isScoredPlayer, requireMember, requirePhase, roomMode, toGuessFor } from "@/lib/api/rooms";
import { writesAnswers } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { putWhose } from "@/lib/validation/schemas";

/** PUT /rooms/:code/whose: Who Said That? guesses, who wrote each of the others' answers. */
export const PUT = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, putWhose);
  const room = await requireMember(code, userId);
  await rateLimit("guesses", room.me.id);
  requirePhase(room.room, "guessing");
  if (!writesAnswers(roomMode(room.room))) throw new ApiError("WRONG_PHASE");
  if (room.me.guesses_submitted_at) throw new ApiError("ALREADY_SUBMITTED");
  const answers = new Set(
    (await toGuessFor(room.room, room.players, room.me.id)).flatMap((q) =>
      q.answers.map((a) => a.id),
    ),
  );
  const others = new Set(
    room.players.filter((p) => isScoredPlayer(p) && p.id !== room.me.id).map((p) => p.id),
  );
  if (body.guesses.some((g) => !answers.has(g.answerId) || !others.has(g.authorId)))
    throw new ApiError("INVALID_TARGET");

  const latest = new Map(body.guesses.map((g) => [g.answerId, g.authorId]));
  const { error } = await getAdminClient()
    .from("text_guesses")
    .upsert(
      [...latest].map(([answerId, authorId]) => ({
        player_id: room.me.id,
        answer_id: answerId,
        room_id: room.room.id,
        round: room.room.round,
        author_id: authorId,
        updated_at: new Date().toISOString(),
      })),
    );
  if (error) throw fromDbError(error);
  return { saved: latest.size };
});
