import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { getSettings } from "@/lib/flags";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { isOwnCustom } from "@/lib/api/customPacks";
import { requireLivePack } from "@/lib/api/packs";
import {
  freshState,
  requireHost,
  requireMember,
  requirePhase,
  roomFloor,
  roomMode,
} from "@/lib/api/rooms";
import { MODE_RULES, modeFormat } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { rematch } from "@/lib/validation/schemas";

/**
 * POST /rooms/:code/rematch: same room code, back to the lobby, optionally with a new pack. The
 * next start draws fresh questions as round + 1 and clears answers and guesses (start_round).
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, rematch);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, "revealed");
  const db = getAdminClient();

  const packId = body.packId ?? room.room.pack_id;
  const floor = roomFloor(room.players);
  // Two-step setup: the next round may be a different game.
  const mode = body.mode ?? roomMode(room.room);
  const rule = MODE_RULES[mode];
  if (!rule.available || (rule.adultOnly && floor < 18)) throw new ApiError("MODE_UNAVAILABLE");
  // Switching to a game switched off in the admin console; a room already playing it may finish.
  if (
    body.mode &&
    body.mode !== roomMode(room.room) &&
    (await getSettings()).disabledModes.includes(body.mode)
  )
    throw new ApiError("MODE_UNAVAILABLE");
  // Custom packs (Batch 3): a rematch keeps the room's own questions, which are yes or no.
  if (isOwnCustom(room.room, packId)) {
    if (modeFormat(mode) !== "yes_no") throw new ApiError("MODE_UNAVAILABLE");
    if (mode !== roomMode(room.room)) {
      const { error } = await db.from("rooms").update({ mode }).eq("id", room.room.id);
      if (error) throw fromDbError(error);
    }
  } else {
    const pack = await requireLivePack(packId, floor, modeFormat(mode));
    const { error } = await db
      .from("rooms")
      .update({
        mode,
        pack_id: pack.id,
        min_age: pack.minAge,
        question_count: body.questionCount
          ? Math.min(body.questionCount, pack.questionCount)
          : room.room.question_count,
      })
      .eq("id", room.room.id);
    if (error) throw fromDbError(error);
  }

  // Everyone who sat out comes back for the new round.
  await db
    .from("players")
    .update({ status: "active" })
    .eq("room_id", room.room.id)
    .eq("status", "sat_out");

  const { error: advanceError } = await db.rpc("advance_room", {
    p_room: room.room.id,
    p_from: "revealed",
    p_to: "lobby",
  });
  if (advanceError && advanceError.message !== "WRONG_PHASE") throw fromDbError(advanceError);
  return freshState(code, userId);
});
