import { ApiError } from "@/lib/api/errors";
import { readBody, route } from "@/lib/api/handler";
import { loadPlayers, advancePhaseIfReady } from "@/lib/api/rooms";
import { nextHost, type PlayerStatus } from "@/lib/game";
import { reportAction } from "@/lib/admin/schemas";
import { audit, requireAdmin } from "@/lib/admin/server";
import { getAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** Same follow-up as a player leaving: pass host on, and let a waiting phase move on. */
async function afterRemoval(roomId: string, playerId: string) {
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
 * POST /admin/reports/:id: dismiss, hide the reported question, or remove the reported player.
 * Hiding a question closes every open report on it.
 */
export const POST = route<Ctx>(async (request, { params }) => {
  const me = await requireAdmin(request, "reports.act");
  const { id } = await params;
  const { action } = await readBody(request, reportAction);
  const db = getAdminClient();
  const { data: report } = await db
    .from("reports")
    .select("id, question_id, player_id, reason, status")
    .eq("id", id)
    .maybeSingle();
  if (!report) throw new ApiError("NOT_FOUND", "No report with that id.");
  const resolved = { resolved_at: new Date().toISOString(), resolved_by: me.userId };

  if (action === "dismiss") {
    const { error } = await db
      .from("reports")
      .update({ status: "dismissed", ...resolved })
      .eq("id", id);
    if (error) throw new ApiError("INTERNAL");
    await audit(
      me,
      "report_dismissed",
      report.reason,
      { status: report.status },
      {
        status: "dismissed",
      },
    );
    return {};
  }

  if (action === "hide_question") {
    if (!report.question_id) throw new ApiError("BAD_REQUEST", "This report has no question.");
    const { data: q } = await db
      .from("questions")
      .select("id, text, status")
      .eq("id", report.question_id)
      .maybeSingle();
    if (!q) throw new ApiError("NOT_FOUND", "That question was deleted.");
    const { error } = await db.from("questions").update({ status: "hidden" }).eq("id", q.id);
    if (error) throw new ApiError("INTERNAL");
    await db
      .from("reports")
      .update({ status: "actioned", ...resolved })
      .eq("question_id", q.id)
      .eq("status", "open");
    await audit(me, "question_hidden", q.text, { status: q.status }, { status: "hidden" });
    return {};
  }

  if (!report.player_id) throw new ApiError("BAD_REQUEST", "This report has no player.");
  const { data: player } = await db
    .from("players")
    .select("id, room_id, nickname, status")
    .eq("id", report.player_id)
    .maybeSingle();
  if (!player) throw new ApiError("PLAYER_NOT_FOUND");
  const { error } = await db.from("players").update({ status: "removed" }).eq("id", player.id);
  if (error) throw new ApiError("INTERNAL");
  await afterRemoval(player.room_id, player.id);
  await db
    .from("reports")
    .update({ status: "actioned", ...resolved })
    .eq("player_id", player.id)
    .eq("status", "open");
  await audit(
    me,
    "player_removed",
    player.nickname,
    { status: player.status },
    {
      status: "removed",
    },
  );
  return {};
});
