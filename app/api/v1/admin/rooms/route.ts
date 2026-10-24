import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { fetchAll, requireAdmin } from "@/lib/admin/server";
import type { AdminRoom } from "@/lib/admin/types";
import { isStuck } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

const LIMIT = 500;

/** GET /admin/rooms: newest rooms first (rooms are deleted after 7 days, so this is all of them). */
export const GET = route(async (request): Promise<AdminRoom[]> => {
  await requireAdmin(request, "rooms.read");
  const db = getAdminClient();
  const [rooms, packs] = await Promise.all([
    db
      .from("rooms")
      .select("id, code, pack_id, status, host_player_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    db.from("packs").select("id, name"),
  ]);
  if (rooms.error || packs.error) throw new ApiError("INTERNAL");
  const list = rooms.data ?? [];
  const oldest = list.at(-1)?.created_at;
  const players = oldest
    ? await fetchAll((from, to) =>
        db
          .from("players")
          .select("id, room_id, nickname, status, joined_at")
          .gte("joined_at", oldest)
          .range(from, to),
      )
    : [];
  const packName = new Map((packs.data ?? []).map((p) => [p.id, p.name]));
  const byId = new Map(players.map((p) => [p.id, p]));
  const active = new Map<string, number>();
  for (const p of players)
    if (p.status === "active" || p.status === "sat_out")
      active.set(p.room_id, (active.get(p.room_id) ?? 0) + 1);
  const now = Date.now();
  return list.map((r) => ({
    id: r.id,
    code: r.code,
    packName: packName.get(r.pack_id) ?? r.pack_id,
    hostNickname: r.host_player_id ? (byId.get(r.host_player_id)?.nickname ?? null) : null,
    players: active.get(r.id) ?? 0,
    status: r.status,
    createdAt: r.created_at,
    stuck: isStuck({ status: r.status, updatedAt: r.updated_at }, now),
  }));
});
