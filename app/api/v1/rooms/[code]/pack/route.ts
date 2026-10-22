import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireLivePack } from "@/lib/api/packs";
import { freshState, requireHost, requireMember, requirePhase } from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";
import { setPack } from "@/lib/validation/schemas";

/** PATCH /rooms/:code/pack: host switches pack in the lobby. Adult packs reset 18+ confirmations. */
export const PATCH = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, setPack);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "lobby");
  const pack = await requireLivePack(body.packId);
  const db = getAdminClient();

  const { error } = await db
    .from("rooms")
    .update({
      pack_id: pack.id,
      question_count: body.questionCount ? Math.min(body.questionCount, pack.questionCount) : null,
    })
    .eq("id", room.room.id);
  if (error) throw fromDbError(error);

  if (pack.isAdult && pack.id !== room.room.pack_id) {
    // The host confirmed on the way in; everyone else must confirm again.
    await db
      .from("players")
      .update({ age_confirmed: false })
      .eq("room_id", room.room.id)
      .eq("is_bot", false)
      .neq("id", room.me.id);
    await db.from("players").update({ age_confirmed: true }).eq("id", room.me.id);
  }
  return freshState(code, userId);
});
