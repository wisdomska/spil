import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/admin/server";
import type { AdminReport } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

const LIMIT = 500;

/** GET /admin/reports: newest first, with the reported question or nickname and the room code. */
export const GET = route(async (request): Promise<AdminReport[]> => {
  await requireAdmin(request, "reports.read");
  const db = getAdminClient();
  const { data, error } = await db
    .from("reports")
    .select("id, type, question_id, player_id, room_id, mode_input_id, reason, status, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw new ApiError("INTERNAL");
  const reports = data ?? [];
  const ids = (key: "question_id" | "player_id" | "room_id" | "mode_input_id") => [
    ...new Set(reports.map((r) => r[key]).filter((v): v is string => Boolean(v))),
  ];
  const [questions, players, rooms, answers] = await Promise.all([
    ids("question_id").length
      ? db.from("questions").select("id, text, status").in("id", ids("question_id"))
      : null,
    ids("player_id").length
      ? db.from("players").select("id, nickname, status").in("id", ids("player_id"))
      : null,
    ids("room_id").length ? db.from("rooms").select("id, code").in("id", ids("room_id")) : null,
    ids("mode_input_id").length
      ? db.from("mode_inputs").select("id, body").in("id", ids("mode_input_id"))
      : null,
  ]);
  const q = new Map((questions?.data ?? []).map((x) => [x.id, x]));
  const p = new Map((players?.data ?? []).map((x) => [x.id, x]));
  const r = new Map((rooms?.data ?? []).map((x) => [x.id, x.code]));
  const a = new Map((answers?.data ?? []).map((x) => [x.id, x.body]));
  return reports.map((x) => ({
    id: x.id,
    type: x.type,
    answerText: x.mode_input_id ? (a.get(x.mode_input_id) ?? null) : null,
    questionId: x.question_id,
    questionText: x.question_id ? (q.get(x.question_id)?.text ?? null) : null,
    questionStatus: x.question_id ? (q.get(x.question_id)?.status ?? null) : null,
    playerId: x.player_id,
    playerNickname: x.player_id ? (p.get(x.player_id)?.nickname ?? null) : null,
    playerStatus: x.player_id ? (p.get(x.player_id)?.status ?? null) : null,
    roomCode: x.room_id ? (r.get(x.room_id) ?? null) : null,
    reason: x.reason,
    status: x.status,
    createdAt: x.created_at,
  }));
});
