import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { pageRange, parsePage, parseSize, type Paged } from "@/lib/admin/paging";
import { fetchAll, requireAdmin } from "@/lib/admin/server";
import type { AdminRoom } from "@/lib/admin/types";
import { isStuck, STUCK_AFTER_MS } from "@/lib/game";
import { getAdminClient } from "@/lib/supabase/admin";

const LIMIT = 500;
const LIVE = ["answering", "guessing", "ready"] as const;
const SELECT = "id, code, pack_id, mode, status, host_player_id, created_at, updated_at";
type RoomRow = {
  id: string;
  code: string;
  pack_id: string;
  mode: string;
  status: AdminRoom["status"];
  host_player_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * GET /admin/rooms: newest rooms first (rooms are deleted after 7 days). With `page` it returns
 * one page `{ rows, total, page, size }`, filtered on the server by `status` (all, active, stuck,
 * finished, closed) and `q` (part of a code); without it, the newest 500 as a list.
 */
export const GET = route(async (request): Promise<AdminRoom[] | Paged<AdminRoom>> => {
  await requireAdmin(request, "rooms.read");
  const db = getAdminClient();
  const params = new URL(request.url).searchParams;
  const packs = await db.from("packs").select("id, name");
  if (packs.error) throw new ApiError("INTERNAL");
  const packName = new Map((packs.data ?? []).map((p) => [p.id, p.name]));

  if (!params.has("page")) {
    const rooms = await db
      .from("rooms")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (rooms.error) throw new ApiError("INTERNAL");
    return withPlayers((rooms.data ?? []) as RoomRow[], packName);
  }

  const page = parsePage(params.get("page"));
  const size = parseSize(params.get("size"));
  const status = params.get("status") ?? "all";
  const code = (params.get("q") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const { from, to } = pageRange(page, size);
  let query = db.from("rooms").select(SELECT, { count: "exact" });
  if (code) query = query.ilike("code", `%${code}%`);
  if (status === "active") query = query.not("status", "in", "(closed,revealed)");
  if (status === "finished") query = query.eq("status", "revealed");
  if (status === "closed") query = query.eq("status", "closed");
  if (status === "stuck")
    query = query
      .in("status", [...LIVE])
      .lte("updated_at", new Date(Date.now() - STUCK_AFTER_MS).toISOString());
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new ApiError("INTERNAL");
  return {
    rows: await withPlayers((data ?? []) as RoomRow[], packName),
    total: count ?? 0,
    page,
    size,
  };
});

async function withPlayers(list: RoomRow[], packName: Map<string, string>): Promise<AdminRoom[]> {
  const db = getAdminClient();
  const ids = list.map((r) => r.id);
  // In chunks of 100 ids, so the filter stays well inside URL length limits.
  const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
    ids.slice(i * 100, i * 100 + 100),
  );
  const players = (
    await Promise.all(
      chunks.map((chunk) =>
        fetchAll((from, to) =>
          db
            .from("players")
            .select("id, room_id, nickname, status")
            .in("room_id", chunk)
            .order("id")
            .range(from, to),
        ),
      ),
    )
  ).flat();
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
    mode: r.mode,
    hostNickname: r.host_player_id ? (byId.get(r.host_player_id)?.nickname ?? null) : null,
    players: active.get(r.id) ?? 0,
    status: r.status,
    createdAt: r.created_at,
    stuck: isStuck({ status: r.status, updatedAt: r.updated_at }, now),
  }));
}
