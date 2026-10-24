import { codeOf, requireUser, type CodeParams } from "@/lib/api/auth";
import { ApiError, fromDbError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { freshState, advancePhaseIfReady, loadPlayers, requireMember } from "@/lib/api/rooms";
import { nextHost, type PlayerStatus } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";
import { isProfane } from "@/lib/validation/profanity";
import { nickname as nicknameSchema, patchMe } from "@/lib/validation/schemas";

/** PATCH /rooms/:code/me: Spill Mode, hide name on card, and (in the lobby) nickname or avatar. */
export const PATCH = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const body = await readBody(request, patchMe);
  const room = await requireMember(code, userId);
  const update: {
    spill_mode?: boolean;
    hide_name_on_card?: boolean;
    nickname?: string;
    avatar?: number;
  } = {};

  if (body.spillMode !== undefined) update.spill_mode = body.spillMode;
  if (body.hideNameOnCard !== undefined) update.hide_name_on_card = body.hideNameOnCard;
  if (body.nickname !== undefined || body.avatar !== undefined) {
    if (room.room.status !== "lobby") throw new ApiError("WRONG_PHASE");
    if (body.avatar !== undefined) update.avatar = body.avatar;
    if (body.nickname !== undefined) {
      const nick = nicknameSchema.safeParse(body.nickname);
      if (!nick.success || isProfane(nick.data)) throw new ApiError("NAME_INVALID");
      const taken = room.players.some(
        (p) =>
          p.id !== room.me.id &&
          (p.status === "active" || p.status === "sat_out") &&
          p.nickname.toLowerCase() === nick.data.toLowerCase(),
      );
      if (taken) throw new ApiError("NAME_TAKEN");
      update.nickname = nick.data;
    }
  }

  const { error } = await getAdminClient().from("players").update(update).eq("id", room.me.id);
  if (error) throw error.code === "23505" ? new ApiError("NAME_TAKEN") : fromDbError(error);
  return freshState(code, userId);
});

/**
 * DELETE /rooms/:code/me: leave. Deletes the caller's answers and guesses, marks them left, and
 * passes host to the earliest active player (or closes the room when only test players remain).
 */
export const DELETE = route<CodeParams>(async (request, ctx) => {
  const userId = await requireUser(request);
  const code = await codeOf(ctx);
  const room = await requireMember(code, userId);
  const db = getAdminClient();

  await db.from("answers").delete().eq("player_id", room.me.id);
  await db.from("guesses").delete().eq("guesser_id", room.me.id);
  await db.from("players").update({ status: "left" }).eq("id", room.me.id);

  const players = await loadPlayers(room.room.id);
  if (room.room.host_player_id === room.me.id) {
    const humans = players.filter((p) => !p.is_bot);
    const host = nextHost(
      humans.map((p) => ({
        id: p.id,
        status: p.status as PlayerStatus,
        joinedAt: p.joined_at,
        lastSeenAt: p.last_seen_at,
      })),
      room.me.id,
      Date.now(),
    );
    if (host) await db.from("rooms").update({ host_player_id: host }).eq("id", room.room.id);
    else
      await db
        .from("rooms")
        .update({ status: "closed", host_player_id: null })
        .eq("id", room.room.id);
  }

  // Leaving can be the last thing a phase was waiting on.
  if (room.room.status === "answering" || room.room.status === "guessing") {
    await advancePhaseIfReady(room.room, players);
  }
  return {};
});
