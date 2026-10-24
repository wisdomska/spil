import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { route } from "@/lib/api/handler";
import {
  advancePhaseIfReady,
  buildState,
  freshState,
  heartbeat,
  requireMember,
} from "@/lib/api/rooms";

/** GET /rooms/:code/state: the caller's full view. Clients poll it and refetch on realtime events. */
export const GET = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const room = await requireMember(await codeOf(ctx), userId);
  await heartbeat(room);
  // A load heals any room left waiting on nobody (SPIL-01); only writes when something changes.
  const after = await advancePhaseIfReady(room.room, room.players);
  if (after !== room.room) return freshState(room.room.code, userId);
  return buildState(room);
});
