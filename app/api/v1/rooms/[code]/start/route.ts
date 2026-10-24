import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import {
  autoplayBots,
  findRoom,
  freshState,
  requireHost,
  requireMember,
  roomMode,
} from "@/lib/api/rooms";
import { getSettings } from "@/lib/flags";
import { canStart, modeMinPlayers, type MinAge, type PlayerStatus } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

/** POST /rooms/:code/start: host starts the round. Draws questions and opens answering. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  requireHost(room);
  const settings = await getSettings();
  const pack = room.pack;

  const check = canStart({
    status: room.room.status,
    minPlayers: modeMinPlayers(roomMode(room.room), settings.minPlayers),
    minAge: pack.min_age as MinAge,
    players: room.players.map((p) => ({
      id: p.id,
      status: p.status as PlayerStatus,
      joinedAt: p.joined_at,
      ageBand: p.age_band,
    })),
  });
  if (!check.ok) throw new ApiError(check.code);

  const { error } = await getAdminClient().rpc("start_round", {
    p_room: room.room.id,
    p_pack: pack.id,
    p_n: room.room.question_count ?? settings.questionsPerGame,
  });
  if (error) throw fromDbError(error);

  const started = await findRoom(code);
  if (started) await autoplayBots(started);
  return freshState(code, userId);
});
