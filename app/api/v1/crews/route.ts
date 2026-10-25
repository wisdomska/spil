import { requireUser } from "@/lib/api/auth";
import { createCrew, myCrews, recordCrewRound } from "@/lib/api/crews";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { requireHost, requireMember, requirePhase, roomMode } from "@/lib/api/rooms";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { createCrewBody } from "@/lib/validation/schemas";

/** GET /crews: the crews I am in. */
export const GET = route(async (request) => myCrews(await requireUser(request)));

/**
 * POST /crews: the host saves the room's group as a crew after the reveal. Only the host joins;
 * everyone else in the room is offered the crew and joins by choice. The room now plays as it.
 */
export const POST = route(async (request) => {
  const userId = await requireUser(request);
  const body = await readBody(request, createCrewBody);
  await rateLimit("write", userId);
  const room = await requireMember(body.roomCode.toUpperCase(), userId);
  requireHost(room);
  requirePhase(room.room, "revealed");
  if (room.room.crew_id) throw new ApiError("WRONG_PHASE", "This room already plays as a crew.");
  const crew = await createCrew(userId, room.me.nickname, body.name);
  const { error } = await getAdminClient()
    .from("rooms")
    .update({ crew_id: crew.id })
    .eq("id", room.room.id);
  if (error) throw fromDbError(error);
  // The round just revealed is the crew's first.
  const { data: rows, error: rowsError } = await getAdminClient()
    .from("results")
    .select("player_id, mind_reader, rank")
    .eq("room_id", room.room.id)
    .eq("round", room.room.round);
  if (rowsError) throw fromDbError(rowsError);
  const byId = new Map(room.players.map((p) => [p.id, p]));
  await recordCrewRound({
    crewId: crew.id,
    roomCode: room.room.code,
    round: room.room.round,
    mode: roomMode(room.room),
    scores: (rows ?? []).flatMap((r) => {
      const p = byId.get(r.player_id);
      return p
        ? [{ userId: p.user_id, nickname: p.nickname, points: r.mind_reader, rank: r.rank }]
        : [];
    }),
  });
  // Every phone in the room refreshes to offer the crew.
  await getAdminClient().rpc("notify_room", { p_room: room.room.id, p_event: "crew_saved" });
  return crew;
});
