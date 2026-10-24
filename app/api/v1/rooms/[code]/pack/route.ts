import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireLivePack } from "@/lib/api/packs";
import { freshState, requireHost, requireMember, requirePhase, roomFloor } from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";
import { setPack } from "@/lib/validation/schemas";

/**
 * PATCH /rooms/:code/pack: host switches pack in the lobby. The pack must suit the youngest
 * player in the room (409 PACK_NOT_ALLOWED otherwise, SPIL-02).
 */
export const PATCH = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, setPack);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "lobby");
  const pack = await requireLivePack(body.packId, roomFloor(room.players));

  const { error } = await getAdminClient()
    .from("rooms")
    .update({
      pack_id: pack.id,
      min_age: pack.minAge,
      question_count: body.questionCount ? Math.min(body.questionCount, pack.questionCount) : null,
    })
    .eq("id", room.room.id);
  if (error) throw fromDbError(error);
  return freshState(code, userId);
});
