import { ApiError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getCounts } from "@/lib/admin/queries";
import { fetchAll, requireAdmin } from "@/lib/admin/server";
import { getSettings } from "@/lib/flags";
import { fillDays, isoDay, totalsSince } from "@/lib/admin/stats";
import type { Overview } from "@/lib/admin/types";
import { getAdminClient } from "@/lib/supabase/admin";

/** GET /admin/overview: today and 7 day numbers, plays per pack, open reports by question. */
export const GET = route(async (request): Promise<Overview> => {
  await requireAdmin(request, "overview.read");
  const db = getAdminClient();
  const now = new Date();
  const weekStart = isoDay(now, 6);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const [stats, plays, packs, reports, counts, captcha, rooms, summary, settings] =
    await Promise.all([
      db
        .from("stats_daily")
        .select("day, games_started, games_finished, joins")
        .gte("day", isoDay(now, 29))
        .order("day", { ascending: false }),
      db.from("pack_plays").select("pack_id, started").gte("day", weekStart),
      db.from("packs").select("id, name").is("room_id", null).order("sort_order").order("name"),
      db.from("reports").select("question_id").eq("status", "open").not("question_id", "is", null),
      getCounts(),
      db
        .from("captcha_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      fetchAll<{ mode: string }>((from, to) =>
        db.from("rooms").select("mode").gte("created_at", weekAgo).range(from, to),
      ),
      db.rpc("admin_user_summary"),
      getSettings(),
    ]);
  if (stats.error || plays.error || packs.error || reports.error || captcha.error)
    throw new ApiError("INTERNAL");

  const days = fillDays(
    (stats.data ?? []).map((d) => ({
      day: d.day,
      gamesStarted: d.games_started,
      gamesFinished: d.games_finished,
      joins: d.joins,
    })),
    now,
    30,
  );

  const byPack = new Map<string, number>();
  for (const p of plays.data ?? [])
    byPack.set(p.pack_id, (byPack.get(p.pack_id) ?? 0) + (p.started ?? 0));
  const packPlays = (packs.data ?? [])
    .map((p) => ({ packId: p.id, name: p.name, started: byPack.get(p.id) ?? 0 }))
    .sort((a, b) => b.started - a.started);

  const byQuestion = new Map<string, number>();
  for (const r of reports.data ?? [])
    if (r.question_id) byQuestion.set(r.question_id, (byQuestion.get(r.question_id) ?? 0) + 1);
  const top = [...byQuestion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const texts = top.length
    ? await db
        .from("questions")
        .select("id, text")
        .in(
          "id",
          top.map(([id]) => id),
        )
    : { data: [] as Array<{ id: string; text: string }> };
  const textOf = new Map((texts.data ?? []).map((q) => [q.id, q.text]));

  const byMode = new Map<string, number>();
  for (const r of rooms) byMode.set(r.mode, (byMode.get(r.mode) ?? 0) + 1);
  const people = (summary.data ?? {}) as { playingNow?: number; banned?: number };

  return {
    modePlays: [...byMode.entries()]
      .map(([mode, started]) => ({ mode, started }))
      .sort((a, b) => b.started - a.started),
    playingNow: people.playingNow ?? 0,
    banned: people.banned ?? 0,
    noticeOn: settings.noticeOn && settings.notice.trim().length > 0,
    gamesOff: settings.disabledModes.length,
    today: totalsSince(days, isoDay(now)),
    week: totalsSince(days, weekStart),
    liveRooms: counts.liveRooms,
    openReports: counts.openReports,
    newMessages: counts.newMessages,
    captchaFailures: captcha.count ?? 0,
    packPlays,
    flagged: top.map(([questionId, count]) => ({
      questionId,
      text: textOf.get(questionId) ?? "",
      count,
    })),
    days,
  };
});
