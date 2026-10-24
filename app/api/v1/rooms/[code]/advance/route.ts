import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import {
  advancePhaseIfReady,
  autoplayBots,
  finalize,
  freshState,
  loadPlayers,
  requireHost,
  requireMember,
  requirePhase,
  type RoomRow,
} from "@/lib/api/rooms";
import { getAdminClient } from "@/lib/supabase/admin";
import { advance } from "@/lib/validation/schemas";

const NEXT = { answering: "guessing", guessing: "ready" } as const;

/**
 * POST /rooms/:code/advance: host moves on. Forcing answering or guessing marks unfinished players
 * sat_out first; ready -> revealed computes and saves results (idempotent).
 */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const { from } = await readBody(request, advance);
  const room = await requireMember(code, userId);
  requireHost(room);
  requirePhase(room.room, from);
  const db = getAdminClient();

  if (from === "ready") {
    await finalize(room.room, await loadPlayers(room.room.id));
    return freshState(code, userId);
  }

  const column = from === "answering" ? "answers_submitted_at" : "guesses_submitted_at";
  await db
    .from("players")
    .update({ status: "sat_out" })
    .eq("room_id", room.room.id)
    .eq("status", "active")
    .is(column, null);

  const { data, error } = await db.rpc("advance_room", {
    p_room: room.room.id,
    p_from: from,
    p_to: NEXT[from],
  });
  if (error && error.message !== "WRONG_PHASE") throw fromDbError(error);
  if (data && (data as RoomRow).status === "guessing") {
    const next = await advancePhaseIfReady(data as RoomRow, await loadPlayers(room.room.id));
    if (next.status === "guessing") await autoplayBots(next);
  }
  return freshState(code, userId);
});
