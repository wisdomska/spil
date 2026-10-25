import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { addCustom, listCustom } from "@/lib/api/customPacks";
import { readBody, route } from "@/lib/api/handler";
import { requireHost, requireMember } from "@/lib/api/rooms";
import { rateLimit } from "@/lib/ratelimit";
import { customQuestionBody } from "@/lib/validation/schemas";

/** GET /rooms/:code/custom: the host's own questions for this room. */
export const GET = route<CodeParams>(async (request, ctx) => {
  const room = await requireMember(await codeOf(ctx), await requireUser(request));
  requireHost(room);
  return listCustom(room.room);
});

/**
 * POST /rooms/:code/custom: the host adds a question (18+ rooms only). It goes through the text
 * filter, like every piece of player-written text.
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const body = await readBody(request, customQuestionBody);
  await rateLimit("write", userId);
  const room = await requireMember(await codeOf(ctx), userId);
  return addCustom(room, body.text);
});
