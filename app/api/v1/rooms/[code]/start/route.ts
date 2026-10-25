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
import {
  canStart,
  hasImposter,
  MAX_WRITTEN_PROMPTS,
  modeMinPlayers,
  writesAnswers,
  type MinAge,
  type PlayerStatus,
} from "@/lib/game";
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
    // Who Said That? plays at most 5 prompts, so the guessing stays quick.
    p_n: writesAnswers(roomMode(room.room))
      ? Math.min(room.room.question_count ?? settings.questionsPerGame, MAX_WRITTEN_PROMPTS)
      : (room.room.question_count ?? settings.questionsPerGame),
  });
  if (error) throw fromDbError(error);

  const started = await findRoom(code);
  // Imposter: one active player, picked at random and told nothing; only the reveal shows it.
  if (started && hasImposter(roomMode(started))) {
    const active = room.players.filter((p) => p.status === "active");
    const pick = active[Math.floor(Math.random() * active.length)];
    if (pick) {
      const { error: pickError } = await getAdminClient()
        .from("imposters")
        .upsert({ room_id: started.id, round: started.round, player_id: pick.id });
      if (pickError) throw fromDbError(pickError);
    }
  }
  if (started) await autoplayBots(started);
  return freshState(code, userId);
});
