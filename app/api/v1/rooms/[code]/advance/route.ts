import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { readBody, route } from "@/lib/api/handler";
import {
  forceAdvance,
  freshState,
  requireHost,
  requireMember,
  requirePhase,
} from "@/lib/api/rooms";
import { advance } from "@/lib/validation/schemas";

/**
 * POST /rooms/:code/advance: host moves on. Forcing answering or guessing marks unfinished players
 * sat_out first; ready -> revealed computes and saves results (idempotent).
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const { from } = await readBody(request, advance);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, from);
  await forceAdvance(room.room);
  return freshState(code, userId);
});
