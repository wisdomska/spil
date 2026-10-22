import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { checkJoinable, findRoom, loadPack, loadPlayers } from "@/lib/api/rooms";
import { getSettings } from "@/lib/flags";
import { randomRotationSeed } from "@/lib/game";
import { rateLimit } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase/admin";
import { isProfane } from "@/lib/validation/profanity";
import { joinRoom, nickname as nicknameSchema } from "@/lib/validation/schemas";

/** POST /rooms/:code/join: adds the caller as a player. The first player becomes host. */
export const POST = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, joinRoom);
  await rateLimit("join", userId);

  const nick = nicknameSchema.safeParse(body.nickname);
  if (!nick.success || isProfane(nick.data)) throw new ApiError("NAME_INVALID");

  const room = await findRoom(code);
  const players = room ? await loadPlayers(room.id) : [];
  const existing = players.find((p) => p.user_id === userId);

  // Already in the room (refresh, second tab): hand back the same player.
  if (existing && (existing.status === "active" || existing.status === "sat_out")) {
    return { playerId: existing.id };
  }
  if (existing?.status === "removed") throw new ApiError("NOT_IN_ROOM", "REMOVED");

  const settings = await getSettings();
  const active = players.filter((p) => p.status === "active");
  checkJoinable(room, active.length, settings.maxPlayers);
  if (!room) throw new ApiError("ROOM_NOT_FOUND");

  const pack = await loadPack(room.pack_id);
  if (pack.is_adult && !body.ageConfirmed) throw new ApiError("AGE_REQUIRED");

  const taken = players.some(
    (p) =>
      p.id !== existing?.id &&
      (p.status === "active" || p.status === "sat_out") &&
      p.nickname.toLowerCase() === nick.data.toLowerCase(),
  );
  if (taken) throw new ApiError("NAME_TAKEN");

  const db = getAdminClient();
  const fields = {
    nickname: nick.data,
    avatar: body.avatar,
    age_confirmed: pack.is_adult ? true : body.ageConfirmed,
    status: "active" as const,
    last_seen_at: new Date().toISOString(),
  };

  let playerId: string;
  if (existing) {
    // Left the lobby earlier and coming back while it is still open.
    const { error } = await db.from("players").update(fields).eq("id", existing.id);
    if (error) throw error.code === "23505" ? new ApiError("NAME_TAKEN") : fromDbError(error);
    playerId = existing.id;
  } else {
    const { data, error } = await db
      .from("players")
      .insert({ ...fields, room_id: room.id, user_id: userId, rotation_seed: randomRotationSeed() })
      .select("id")
      .single();
    if (error) throw error.code === "23505" ? new ApiError("NAME_TAKEN") : fromDbError(error);
    playerId = data.id;
  }

  if (
    !room.host_player_id ||
    !players.some((p) => p.id === room.host_player_id && p.status === "active")
  ) {
    await db.from("rooms").update({ host_player_id: playerId }).eq("id", room.id);
  }

  if (!existing) await db.rpc("record_join");
  return { playerId };
});
