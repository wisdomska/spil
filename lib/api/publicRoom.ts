import "server-only";
import { isRoomExpired } from "@/lib/game";
import { getSettings } from "@/lib/flags";
import { ApiError } from "./errors";
import { findRoom, loadPack, loadPlayers, packSummary } from "./rooms";
import type { PublicRoom } from "./types";

/**
 * The public preview of a room for the join flow and link previews: no answers, no ids. Used by
 * GET /rooms/:code and server-rendered on the invite page (SPIL-19), where `userId` is unknown.
 */
export async function publicRoom(code: string, userId: string | null): Promise<PublicRoom> {
  const room = await findRoom(code);
  if (!room) throw new ApiError("ROOM_NOT_FOUND");
  if (isRoomExpired({ status: room.status, createdAt: room.created_at }, Date.now()))
    throw new ApiError("ROOM_EXPIRED");
  const [players, pack, settings] = await Promise.all([
    loadPlayers(room.id),
    loadPack(room.pack_id),
    getSettings(),
  ]);
  const active = players.filter((p) => p.status === "active");
  const host = players.find((p) => p.id === room.host_player_id);
  return {
    code: room.code,
    status: room.status,
    pack: packSummary(pack),
    hostNickname: host?.nickname ?? null,
    hostAvatar: host?.avatar ?? null,
    playerCount: active.length,
    maxPlayers: settings.maxPlayers,
    minAge: pack.min_age as PublicRoom["minAge"],
    ageLockHours: settings.ageLockHours,
    joined: Boolean(
      userId &&
      players.some(
        (p) => p.user_id === userId && (p.status === "active" || p.status === "sat_out"),
      ),
    ),
  };
}
