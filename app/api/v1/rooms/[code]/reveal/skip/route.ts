import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { freshState, requireHost, requireMember, requirePhase } from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";

/** POST /rooms/:code/reveal/skip: the host jumps every phone to the results (SPIL-11). */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "revealed");
  // Past any slide count: the reveal is over on every phone.
  const { error } = await getAdminClient()
    .from("rooms")
    .update({ reveal_index: 1000, reveal_at: new Date().toISOString() })
    .eq("id", room.room.id);
  if (error) throw fromDbError(error);
  return freshState(code, userId);
});
