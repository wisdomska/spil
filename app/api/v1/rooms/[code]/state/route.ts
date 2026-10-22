import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { route } from "@/lib/api/handler";
import { buildState, heartbeat, requireMember } from "@/lib/api/rooms";

/** GET /rooms/:code/state: the caller's full view. Clients poll it and refetch on realtime events. */
export const GET = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const room = await requireMember(await codeOf(ctx), userId);
  await heartbeat(room);
  return buildState(room);
});
