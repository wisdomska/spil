import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { useCustom } from "@/lib/api/customPacks";
import { route } from "@/lib/api/handler";
import { freshState, requireMember } from "@/lib/api/rooms";

/** POST /rooms/:code/custom/use: play the host's own questions; the room becomes 18+. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  await useCustom(room);
  return freshState(code, userId);
});
