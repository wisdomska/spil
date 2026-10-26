import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/admin/server";
import { pageRange, parsePage, parseSize, type Paged } from "@/lib/admin/paging";
import type { AdminReport } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

const LIMIT = 500;

const SELECT =
  "id, type, question_id, player_id, room_id, mode_input_id, reason, status, created_at";
const STATUSES = ["open", "actioned", "dismissed"];

/**
 * GET /admin/reports: newest first, with the reported question or nickname and the room code.
 * With `page` it returns one page `{ rows, total, page, size }` filtered by `status` (open,
 * actioned, dismissed or all); without it, the newest 500 as a list.
 */
export const GET = route(async (request): Promise<AdminReport[] | Paged<AdminReport>> => {
  await requireAdmin(request, "reports.read");
  const db = getAdminClient();
  const params = new URL(request.url).searchParams;
  if (!params.has("page")) {
    const { data, error } = await db
      .from("reports")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (error) throw new ApiError("INTERNAL");
    return describe(data ?? []);
  }
  const page = parsePage(params.get("page"));
  const size = parseSize(params.get("size"));
  const status = params.get("status") ?? "open";
  const { from, to } = pageRange(page, size);
  let query = db.from("reports").select(SELECT, { count: "exact" });
  if (STATUSES.includes(status)) query = query.eq("status", status as "open");
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new ApiError("INTERNAL");
  return { rows: await describe(data ?? []), total: count ?? 0, page, size };
});

type ReportRow = {
  id: string;
  type: AdminReport["type"];
  question_id: string | null;
  player_id: string | null;
  room_id: string | null;
  mode_input_id: string | null;
  reason: string;
  status: AdminReport["status"];
  created_at: string;
};

/** Adds the question text, nickname, answer and room code each report points at. */
async function describe(reports: ReportRow[]): Promise<AdminReport[]> {
  const db = getAdminClient();
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
}
