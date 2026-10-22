import { codeOf, type CodeParams } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { findRoom, loadPack, loadPlayers, packSummary } from "@/lib/api/rooms";
import type { PublicRoom } from "@/lib/api/types";
import { getSettings } from "@/lib/flags";
import { isRoomExpired } from "@/lib/game";

/** GET /rooms/:code: public preview for the join flow and link previews. No answers, no ids. */
export const GET = route<CodeParams>(async (_request, ctx) => {
  const code = await codeOf(ctx);
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
  const body: PublicRoom = {
    code: room.code,
    status: room.status,
    pack: packSummary(pack),
    hostNickname: players.find((p) => p.id === room.host_player_id)?.nickname ?? null,
    playerCount: active.length,
    maxPlayers: settings.maxPlayers,
  };
  return body;
});
