import "server-only";
import { loadPlayers, advancePhaseIfReady } from "@/lib/api/rooms";
import { nextHost, type PlayerStatus } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

/** Same follow-up as a player leaving: pass host on, and let a waiting phase move on. */
export async function afterRemoval(roomId: string, playerId: string) {
  const db = getAdminClient();
  const { data: room } = await db.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room || room.status === "closed") return;
  const players = await loadPlayers(roomId);
  if (room.host_player_id === playerId) {
    const host = nextHost(
      players
        .filter((p) => !p.is_bot)
        .map((p) => ({
          id: p.id,
          status: p.status as PlayerStatus,
          joinedAt: p.joined_at,
          lastSeenAt: p.last_seen_at,
        })),
      playerId,
      Date.now(),
    );
    await db
      .from("rooms")
      .update(host ? { host_player_id: host } : { status: "closed", host_player_id: null })
      .eq("id", roomId);
    if (!host) return;
  }
  if (room.status === "answering" || room.status === "guessing")
    await advancePhaseIfReady(room, players);
}

/**
 * Takes a person out of every room they are still playing in (admin kick or ban): each active
 * player row is marked removed, then the room carries on as if they had left.
 */
export async function removeFromLiveRooms(userId: string): Promise<number> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("players")
    .select("id, room_id, rooms!players_room_id_fkey!inner(status)")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("rooms.status", "closed");
  if (error) throw error;
  for (const p of data ?? []) {
    await db.from("players").update({ status: "removed" }).eq("id", p.id);
    await afterRemoval(p.room_id, p.id);
  }
  return data?.length ?? 0;
}
