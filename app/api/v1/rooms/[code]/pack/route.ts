import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireLivePack } from "@/lib/api/packs";
import {
  freshState,
  requireHost,
  requireMember,
  requirePhase,
  roomFloor,
  roomMode,
} from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/errors";
import { MODE_RULES, modeFormat } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { setPack } from "@/lib/validation/schemas";

/**
 * PATCH /rooms/:code/pack: host switches pack, length or game in the lobby. The pack must suit
 * the youngest player in the room (409 PACK_NOT_ALLOWED otherwise, SPIL-02) and the game; an
 * adult-only game needs everyone to be 18 or older (409 MODE_UNAVAILABLE).
 */
export const PATCH = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, setPack);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "lobby");
  const floor = roomFloor(room.players);
  const mode = body.mode ?? roomMode(room.room);
  const rule = MODE_RULES[mode];
  if (!rule.available || (rule.adultOnly && floor < 18)) throw new ApiError("MODE_UNAVAILABLE");
  const pack = await requireLivePack(body.packId, floor, modeFormat(mode));

  const { error } = await getAdminClient()
    .from("rooms")
    .update({
      mode,
      pack_id: pack.id,
      min_age: pack.minAge,
      question_count: body.questionCount ? Math.min(body.questionCount, pack.questionCount) : null,
    })
    .eq("id", room.room.id);
  if (error) throw fromDbError(error);
  return freshState(code, userId);
});
