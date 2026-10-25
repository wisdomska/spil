import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireMember, requirePhase } from "@/lib/api/rooms";
import { isReaction } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { postReaction } from "@/lib/validation/schemas";

/**
 * POST /rooms/:code/react: a live reaction during the reveal (Batch 2). One of the fixed emoji,
 * broadcast to the room and never stored. Rate limited per player.
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, postReaction);
  if (!isReaction(body.emoji)) throw new ApiError("BAD_REQUEST");
  const room = await requireMember(code, userId);
  requirePhase(room.room, "revealed");
  await rateLimit("react", room.me.id);
  const { error } = await getAdminClient().rpc("send_reaction", {
    p_room: room.room.id,
    p_player: room.me.id,
    p_emoji: body.emoji,
  });
  if (error) throw fromDbError(error);
  return {};
});
