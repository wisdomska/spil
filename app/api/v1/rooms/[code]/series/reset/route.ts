import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { freshState, requireHost, requireMember, requirePhase } from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";

/** POST /rooms/:code/series/reset: the host starts a new series from the next round (SPIL-18). */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "revealed");
  const db = getAdminClient();
  const { error } = await db
    .from("rooms")
    .update({ series_start: room.room.round + 1 })
    .eq("id", room.room.id);
  if (error) throw fromDbError(error);
  await db.rpc("notify_room", { p_room: room.room.id, p_event: "series_reset" });
  return freshState(code, userId);
});
